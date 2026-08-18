# GBN 世界地形烘焙与渲染 实施计划（层 1）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 16×10 ASCII 图烘焙成 WorldClaw 式连续地形，在浏览器里渲染出可点击拾取的 3D 世界，替换现有六角格地图。

**Architecture:** 纯函数层（`shared/src/world/`）实现种子噪声、地貌算子、掩膜升采样与论文 Eq.6 高度场合成，全部可在 node 下测试；离线 CLI（`tools/bake-world.ts`）消费纯函数层产出二进制资产到 `web/public/world/`；渲染层（`web/src/world/`）只加载资产并位移网格，不重算高度场。

**Tech Stack:** TypeScript 5.9 · npm workspaces · vitest 3.2 · three.js 0.185 · @react-three/fiber 9 · React 19 · Vite 7 · tsx（跑 CLI）

## Global Constraints

- 所有新纯函数模块放在 `shared/src/world/`，**不得 import three.js 或任何浏览器 API**（要在 node 下测）
- 一切随机必须走显式种子；同种子同参数必须逐元素一致
- 世界分辨率：高度场与掩膜 `res = 512`（正方形采样），渲染网格 `meshRes = 256`
- 世界范围为**矩形**：`sizeX = 400`、`sizeZ = 250`（three.js 单位，1.6:1，与 16×10 的 ASCII 图长宽比一致）。掩膜按正方形采样，世界范围按矩形映射，二者不可混用同一个标量
- 二进制资产格式：高度图 `Uint16` 量化、区域图 `Uint8` 索引，元数据走 `world-spec.json`，**不引入 PNG 编解码依赖**
- 测试文件与源码同目录，命名 `*.test.ts`，用根目录 `npx vitest run` 执行
- 提交信息用中文，遵循 `feat:` / `test:` / `refactor:` 前缀
- 本计划**不涉及任何 3D 生成 API**（Tripo key 未到位，见 spec §4.1）

---

### Task 1: 种子随机与噪声

**Files:**
- Create: `shared/src/world/rng.ts`
- Create: `shared/src/world/noise.ts`
- Test: `shared/src/world/noise.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `mulberry32(seed: number): () => number`、`hashSeed(s: string): number`、`makeValueNoise2D(rand: () => number): (x: number, y: number) => number`、`fbm(noise: (x: number, y: number) => number, x: number, y: number, octaves: number, lacunarity: number, gain: number): number`

- [ ] **Step 1: 写失败的测试**

创建 `shared/src/world/noise.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { hashSeed, mulberry32 } from './rng.js'
import { fbm, makeValueNoise2D } from './noise.js'

describe('rng', () => {
  it('同种子产出同序列', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    expect([a(), a(), a(), a()]).toEqual([b(), b(), b(), b()])
  })

  it('不同种子产出不同序列', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)())
  })

  it('输出落在 [0,1)', () => {
    const r = mulberry32(7)
    for (let i = 0; i < 500; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('hashSeed 稳定且区分字符串', () => {
    expect(hashSeed('benchylvania')).toBe(hashSeed('benchylvania'))
    expect(hashSeed('benchylvania')).not.toBe(hashSeed('print-republic'))
  })
})

describe('value noise', () => {
  it('同种子的噪声场逐点一致', () => {
    const n1 = makeValueNoise2D(mulberry32(9))
    const n2 = makeValueNoise2D(mulberry32(9))
    for (const [x, y] of [[0.5, 0.5], [3.25, 7.75], [12.1, 0.3]]) {
      expect(n1(x, y)).toBeCloseTo(n2(x, y), 12)
    }
  })

  it('输出落在 [-1,1]', () => {
    const n = makeValueNoise2D(mulberry32(3))
    for (let i = 0; i < 300; i++) {
      const v = n(i * 0.37, i * 0.91)
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('整数格点附近连续，不跳变', () => {
    const n = makeValueNoise2D(mulberry32(5))
    expect(Math.abs(n(2 - 1e-6, 3) - n(2 + 1e-6, 3))).toBeLessThan(1e-4)
  })

  it('fbm 叠加后仍在 [-1,1] 且确定', () => {
    const n = makeValueNoise2D(mulberry32(11))
    const v1 = fbm(n, 1.5, 2.5, 4, 2, 0.5)
    expect(v1).toBe(fbm(n, 1.5, 2.5, 4, 2, 0.5))
    expect(v1).toBeGreaterThanOrEqual(-1)
    expect(v1).toBeLessThanOrEqual(1)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run shared/src/world/noise.test.ts`
Expected: FAIL，报 `Cannot find module './rng.js'`

- [ ] **Step 3: 实现 rng.ts**

创建 `shared/src/world/rng.ts`：

```ts
// 种子随机。所有生成必须显式传种子，保证烘焙可复现。

/** mulberry32：小而快的 32 位种子 PRNG，输出 [0,1) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a：把国家 id 之类的字符串稳定映射成种子 */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
```

- [ ] **Step 4: 实现 noise.ts**

创建 `shared/src/world/noise.ts`：

```ts
// 2D value noise + fbm。不依赖任何浏览器 API。

const TABLE = 256
const MASK = TABLE - 1

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * 用给定 PRNG 构造确定的 2D value noise 场，输出 [-1,1]。
 * 值表在构造时一次生成，之后采样是纯函数。
 */
export function makeValueNoise2D(rand: () => number): (x: number, y: number) => number {
  const vals = new Float64Array(TABLE * TABLE)
  for (let i = 0; i < vals.length; i++) vals[i] = rand() * 2 - 1

  const at = (ix: number, iy: number) => vals[((iy & MASK) * TABLE) + (ix & MASK)]

  return (x: number, y: number) => {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = fade(x - x0)
    const fy = fade(y - y0)
    const top = lerp(at(x0, y0), at(x0 + 1, y0), fx)
    const bot = lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), fx)
    return lerp(top, bot, fy)
  }
}

/** 分形叠加，归一化到 [-1,1] */
export function fbm(
  noise: (x: number, y: number) => number,
  x: number,
  y: number,
  octaves: number,
  lacunarity: number,
  gain: number,
): number {
  let sum = 0
  let amp = 1
  let freq = 1
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq, y * freq)
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return norm > 0 ? sum / norm : 0
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run shared/src/world/noise.test.ts`
Expected: PASS，8 个用例全绿

- [ ] **Step 6: 提交**

```bash
git add shared/src/world/rng.ts shared/src/world/noise.ts shared/src/world/noise.test.ts
git commit -m "feat: 种子随机与 2D value noise"
```

---

### Task 2: 地貌算子

**Files:**
- Create: `shared/src/world/geomorph.ts`
- Test: `shared/src/world/geomorph.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `type GeomorphKind = 'ridge' | 'terrace' | 'dune' | 'erode'`、`ridge(n: number): number`、`terrace(v: number, steps: number): number`、`dune(x: number, y: number, angle: number, freq: number): number`、`erode(v: number, gradMag: number, k: number): number`

- [ ] **Step 1: 写失败的测试**

创建 `shared/src/world/geomorph.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { dune, erode, ridge, terrace } from './geomorph.js'

describe('ridge 山脊算子', () => {
  it('噪声为 0 时脊线最高', () => {
    expect(ridge(0)).toBeCloseTo(1, 12)
  })
  it('噪声为 ±1 时降到 0', () => {
    expect(ridge(1)).toBeCloseTo(0, 12)
    expect(ridge(-1)).toBeCloseTo(0, 12)
  })
  it('关于 0 对称', () => {
    expect(ridge(0.37)).toBeCloseTo(ridge(-0.37), 12)
  })
})

describe('terrace 阶地算子', () => {
  it('把连续值量化成有限级数', () => {
    const seen = new Set<number>()
    for (let i = 0; i <= 100; i++) seen.add(terrace(i / 100, 4))
    expect(seen.size).toBeLessThanOrEqual(5)
  })
  it('保持单调不减', () => {
    let prev = -Infinity
    for (let i = 0; i <= 100; i++) {
      const v = terrace(i / 100, 5)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
  it('端点不越界', () => {
    expect(terrace(0, 6)).toBeGreaterThanOrEqual(0)
    expect(terrace(1, 6)).toBeLessThanOrEqual(1)
  })
})

describe('dune 沙丘算子', () => {
  it('沿波矢方向周期性重复', () => {
    const freq = 2
    expect(dune(0, 0, 0, freq)).toBeCloseTo(dune((Math.PI * 2) / freq, 0, 0, freq), 10)
  })
  it('输出落在 [0,1]', () => {
    for (let i = 0; i < 200; i++) {
      const v = dune(i * 0.13, i * 0.29, 0.6, 3)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})

describe('erode 侵蚀算子', () => {
  it('坡度越大削得越多', () => {
    expect(erode(1, 0.8, 0.5)).toBeLessThan(erode(1, 0.1, 0.5))
  })
  it('坡度为 0 时不改变原值', () => {
    expect(erode(0.7, 0, 0.5)).toBeCloseTo(0.7, 12)
  })
  it('不会削到负值', () => {
    expect(erode(0.05, 10, 1)).toBeGreaterThanOrEqual(0)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run shared/src/world/geomorph.test.ts`
Expected: FAIL，`Cannot find module './geomorph.js'`

- [ ] **Step 3: 实现 geomorph.ts**

创建 `shared/src/world/geomorph.ts`：

```ts
// 地貌算子，对应论文 Eq.6 里的 G_{r,j}。
// 每个算子都是纯函数，输出统一归一化到 [0,1]，贡献大小由权重 λ 决定。

export type GeomorphKind = 'ridge' | 'terrace' | 'dune' | 'erode'

/** 山脊：把噪声取绝对值后翻折，零交叉处形成锐利脊线 */
export function ridge(n: number): number {
  return 1 - Math.abs(n)
}

/** 阶地：把连续高度量化成台阶 */
export function terrace(v: number, steps: number): number {
  if (steps <= 1) return v
  return Math.round(v * steps) / steps
}

/** 沙丘：沿指定方向的正弦波，归一化到 [0,1] */
export function dune(x: number, y: number, angle: number, freq: number): number {
  const k = x * Math.cos(angle) + y * Math.sin(angle)
  return (Math.sin(k * freq) + 1) / 2
}

/** 侵蚀：按局部坡度削减高度，不低于 0 */
export function erode(v: number, gradMag: number, k: number): number {
  return Math.max(0, v - k * gradMag * v)
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run shared/src/world/geomorph.test.ts`
Expected: PASS，11 个用例全绿

- [ ] **Step 5: 提交**

```bash
git add shared/src/world/geomorph.ts shared/src/world/geomorph.test.ts
git commit -m "feat: 地貌算子 ridge/terrace/dune/erode"
```

---

### Task 3: ASCII 图升采样为区域掩膜

**Files:**
- Create: `shared/src/world/masks.ts`
- Test: `shared/src/world/masks.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `interface RegionMasks { res: number; keys: string[]; data: Float32Array }`（`data` 长度为 `keys.length * res * res`，按区域分平面排列）
  - `buildMasks(rows: string[], res: number, softness: number): RegionMasks`
  - `maskAt(m: RegionMasks, regionIndex: number, ix: number, iy: number): number`
  - `dominantRegion(m: RegionMasks, ix: number, iy: number): number`

- [ ] **Step 1: 写失败的测试**

创建 `shared/src/world/masks.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { buildMasks, dominantRegion, maskAt } from './masks.js'

const ROWS = [
  'aaaabbbb',
  'aaaabbbb',
  'aaaabbbb',
  'ccccdddd',
  'ccccdddd',
  'ccccdddd',
]

describe('buildMasks', () => {
  it('收集到全部区域键', () => {
    expect([...buildMasks(ROWS, 64, 2).keys].sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('任意像素处各区权重和为 1', () => {
    const m = buildMasks(ROWS, 64, 4)
    for (let iy = 0; iy < m.res; iy += 7) {
      for (let ix = 0; ix < m.res; ix += 7) {
        let sum = 0
        for (let r = 0; r < m.keys.length; r++) sum += maskAt(m, r, ix, iy)
        expect(sum).toBeCloseTo(1, 6)
      }
    }
  })

  it('区域内部权重接近 1', () => {
    const m = buildMasks(ROWS, 64, 2)
    expect(maskAt(m, m.keys.indexOf('a'), 4, 4)).toBeGreaterThan(0.9)
  })

  it('softness 越大过渡带越宽', () => {
    const band = (softness: number) => {
      const m = buildMasks(ROWS, 128, softness)
      const ai = m.keys.indexOf('a')
      let count = 0
      for (let ix = 0; ix < m.res; ix++) {
        const w = maskAt(m, ai, ix, 10)
        if (w > 0.05 && w < 0.95) count++
      }
      return count
    }
    expect(band(8)).toBeGreaterThan(band(2))
  })

  it('dominantRegion 在区域内部返回该区', () => {
    const m = buildMasks(ROWS, 64, 2)
    expect(m.keys[dominantRegion(m, 4, 4)]).toBe('a')
    expect(m.keys[dominantRegion(m, 60, 60)]).toBe('d')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run shared/src/world/masks.test.ts`
Expected: FAIL，`Cannot find module './masks.js'`

- [ ] **Step 3: 实现 masks.ts 的类型与查询**

创建 `shared/src/world/masks.ts`，先写文件头与查询函数：

```ts
// ASCII 图 → 区域掩膜。对应论文 2.2.3 的区域掩膜提取与边界软化：
// 指示函数 → 双线性升采样 → 高斯软化 → 逐像素归一化。
// 归一化保证 Σ_r m_r(x) = 1，这是 Eq.6 成立的前提。

export interface RegionMasks {
  res: number
  /** 区域键，顺序固定；索引即 data 里的平面序号 */
  keys: string[]
  /** 长度 keys.length * res * res */
  data: Float32Array
}

export function maskAt(m: RegionMasks, regionIndex: number, ix: number, iy: number): number {
  return m.data[regionIndex * m.res * m.res + iy * m.res + ix]
}

export function dominantRegion(m: RegionMasks, ix: number, iy: number): number {
  let best = 0
  let bestW = -1
  for (let r = 0; r < m.keys.length; r++) {
    const w = maskAt(m, r, ix, iy)
    if (w > bestW) { bestW = w; best = r }
  }
  return best
}
```

- [ ] **Step 4: 接着写高斯模糊**

在同一文件继续追加：

```ts
/** 一维高斯核，半径取 3σ */
function gaussianKernel(sigma: number): Float32Array {
  if (sigma <= 0) return Float32Array.from([1])
  const radius = Math.max(1, Math.ceil(sigma * 3))
  const k = new Float32Array(radius * 2 + 1)
  let sum = 0
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma))
    k[i + radius] = v
    sum += v
  }
  for (let i = 0; i < k.length; i++) k[i] /= sum
  return k
}

/** 可分离高斯模糊，边缘按夹取处理 */
function blur(plane: Float32Array, res: number, sigma: number): Float32Array {
  const k = gaussianKernel(sigma)
  const radius = (k.length - 1) / 2
  const tmp = new Float32Array(res * res)
  const out = new Float32Array(res * res)

  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      let acc = 0
      for (let i = -radius; i <= radius; i++) {
        const sx = Math.min(res - 1, Math.max(0, x + i))
        acc += plane[y * res + sx] * k[i + radius]
      }
      tmp[y * res + x] = acc
    }
  }
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      let acc = 0
      for (let i = -radius; i <= radius; i++) {
        const sy = Math.min(res - 1, Math.max(0, y + i))
        acc += tmp[sy * res + x] * k[i + radius]
      }
      out[y * res + x] = acc
    }
  }
  return out
}
```

- [ ] **Step 5: 最后写 buildMasks**

在同一文件继续追加：

```ts
/**
 * @param rows     等宽字符行，一个字符 = 一个源格
 * @param res      输出分辨率（正方形）
 * @param softness 边界软化强度，单位为输出像素的高斯 σ
 */
export function buildMasks(rows: string[], res: number, softness: number): RegionMasks {
  const srcH = rows.length
  const srcW = rows[0].length
  const keys = [...new Set(rows.join('').split(''))].sort()
  const planes = keys.map(() => new Float32Array(res * res))

  for (let y = 0; y < res; y++) {
    const sy = (y / (res - 1)) * (srcH - 1)
    const y0 = Math.floor(sy)
    const y1 = Math.min(srcH - 1, y0 + 1)
    const ty = sy - y0
    for (let x = 0; x < res; x++) {
      const sx = (x / (res - 1)) * (srcW - 1)
      const x0 = Math.floor(sx)
      const x1 = Math.min(srcW - 1, x0 + 1)
      const tx = sx - x0
      const idx = y * res + x
      for (let r = 0; r < keys.length; r++) {
        const ch = keys[r]
        const v00 = rows[y0][x0] === ch ? 1 : 0
        const v10 = rows[y0][x1] === ch ? 1 : 0
        const v01 = rows[y1][x0] === ch ? 1 : 0
        const v11 = rows[y1][x1] === ch ? 1 : 0
        const top = v00 + (v10 - v00) * tx
        const bot = v01 + (v11 - v01) * tx
        planes[r][idx] = top + (bot - top) * ty
      }
    }
  }

  const blurred = planes.map(p => blur(p, res, softness))

  const data = new Float32Array(keys.length * res * res)
  for (let i = 0; i < res * res; i++) {
    let sum = 0
    for (let r = 0; r < keys.length; r++) sum += blurred[r][i]
    if (sum <= 0) { data[i] = 1; continue }
    for (let r = 0; r < keys.length; r++) {
      data[r * res * res + i] = blurred[r][i] / sum
    }
  }

  return { res, keys, data }
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `npx vitest run shared/src/world/masks.test.ts`
Expected: PASS，5 个用例全绿

- [ ] **Step 7: 提交**

```bash
git add shared/src/world/masks.ts shared/src/world/masks.test.ts
git commit -m "feat: ASCII 图升采样为归一化区域掩膜"
```

---

### Task 4: Eq.6 高度场合成与采样

**Files:**
- Create: `shared/src/world/profiles.ts`
- Create: `shared/src/world/heightfield.ts`
- Test: `shared/src/world/heightfield.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `mulberry32` / `makeValueNoise2D` / `fbm`，Task 2 的 `ridge` / `terrace` / `dune` / `erode` / `GeomorphKind`，Task 3 的 `RegionMasks` / `maskAt` / `buildMasks`
- Produces:
  - `interface NoiseLayer { freq: number; amp: number }`
  - `interface OpSpec { kind: GeomorphKind; weight: number; freq?: number; angle?: number; steps?: number; k?: number }`
  - `interface TerrainProfile { base: number; noise: NoiseLayer[]; ops: OpSpec[] }`
  - `TERRAIN_PROFILES: Record<string, TerrainProfile>`
  - `interface Heightfield { res: number; sizeX: number; sizeZ: number; data: Float32Array; min: number; max: number }`
  - `buildHeightfield(masks: RegionMasks, profiles: Record<string, TerrainProfile>, seed: number, sizeX: number, sizeZ: number): Heightfield`
  - `sampleHeight(hf: Heightfield, x: number, z: number): number`
  - `sampleHeightOnMesh(hf: Heightfield, x: number, z: number, meshRes: number): number`

- [ ] **Step 1: 写失败的测试**

创建 `shared/src/world/heightfield.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { buildMasks } from './masks.js'
import {
  TERRAIN_PROFILES, buildHeightfield, sampleHeight, sampleHeightOnMesh,
} from './heightfield.js'

const ROWS = [
  'ppppmmmm',
  'ppppmmmm',
  'ppppmmmm',
  'cccciiii',
  'cccciiii',
  'cccciiii',
]

const build = (seed: number) =>
  buildHeightfield(buildMasks(ROWS, 64, 3), TERRAIN_PROFILES, seed, 400, 250)

describe('buildHeightfield', () => {
  it('同种子逐元素一致', () => {
    const a = build(123)
    const b = build(123)
    expect(a.data.length).toBe(b.data.length)
    for (let i = 0; i < a.data.length; i++) expect(a.data[i]).toBe(b.data[i])
  })

  it('不同种子产出不同地形', () => {
    const a = build(1)
    const b = build(2)
    let diff = 0
    for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) diff++
    expect(diff).toBeGreaterThan(a.data.length * 0.5)
  })

  it('山地区域平均高于海岸区域', () => {
    const hf = build(77)
    const avg = (x0: number, x1: number, y0: number, y1: number) => {
      let s = 0
      let n = 0
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) { s += hf.data[y * hf.res + x]; n++ }
      }
      return s / n
    }
    expect(avg(40, 60, 4, 20)).toBeGreaterThan(avg(4, 24, 44, 60))
  })

  it('min/max 与数据一致', () => {
    const hf = build(5)
    let mn = Infinity
    let mx = -Infinity
    for (const v of hf.data) { if (v < mn) mn = v; if (v > mx) mx = v }
    expect(hf.min).toBeCloseTo(mn, 6)
    expect(hf.max).toBeCloseTo(mx, 6)
  })
})

describe('采样', () => {
  it('格点处采样等于数组值', () => {
    const hf = build(9)
    const cellX = hf.sizeX / (hf.res - 1)
    const cellZ = hf.sizeZ / (hf.res - 1)
    const ix = 17
    const iy = 23
    const x = -hf.sizeX / 2 + ix * cellX
    const z = -hf.sizeZ / 2 + iy * cellZ
    expect(sampleHeight(hf, x, z)).toBeCloseTo(hf.data[iy * hf.res + ix], 5)
  })

  it('越界坐标被夹取，不产生 NaN', () => {
    const hf = build(9)
    expect(Number.isFinite(sampleHeight(hf, -9999, -9999))).toBe(true)
    expect(Number.isFinite(sampleHeight(hf, 9999, 9999))).toBe(true)
  })

  it('网格顶点处两种采样完全一致', () => {
    const hf = build(31)
    const meshRes = 256
    const cellX = hf.sizeX / (meshRes - 1)
    const cellZ = hf.sizeZ / (meshRes - 1)
    for (const [i, j] of [[0, 0], [37, 91], [128, 128], [meshRes - 1, meshRes - 1]]) {
      const x = -hf.sizeX / 2 + i * cellX
      const z = -hf.sizeZ / 2 + j * cellZ
      expect(sampleHeightOnMesh(hf, x, z, meshRes)).toBeCloseTo(sampleHeight(hf, x, z), 10)
    }
  })

  it('网格插值结果落在所在单元四角高度的区间内', () => {
    const hf = build(31)
    const meshRes = 256
    const cellX = hf.sizeX / (meshRes - 1)
    const cellZ = hf.sizeZ / (meshRes - 1)
    const at = (i: number, j: number) =>
      sampleHeight(hf, -hf.sizeX / 2 + i * cellX, -hf.sizeZ / 2 + j * cellZ)
    for (let k = 0; k < 50; k++) {
      const cx = 3 + ((k * 7) % (meshRes - 5))
      const cz = 3 + ((k * 11) % (meshRes - 5))
      const corners = [at(cx, cz), at(cx + 1, cz), at(cx, cz + 1), at(cx + 1, cz + 1)]
      const v = sampleHeightOnMesh(
        hf,
        -hf.sizeX / 2 + (cx + 0.5) * cellX,
        -hf.sizeZ / 2 + (cz + 0.5) * cellZ,
        meshRes,
      )
      expect(v).toBeGreaterThanOrEqual(Math.min(...corners) - 1e-6)
      expect(v).toBeLessThanOrEqual(Math.max(...corners) + 1e-6)
    }
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run shared/src/world/heightfield.test.ts`
Expected: FAIL，`Cannot find module './heightfield.js'`

- [ ] **Step 3: 实现 profiles.ts**

创建 `shared/src/world/profiles.ts`：

```ts
// 每个地形键的 Eq.6 参数：基准高程 h_r、噪声层 w_{r,k}N_{r,k}、地貌算子 λ_{r,j}G_{r,j}。
// base 沿用 shared/src/data.ts 里 TERRAIN.height 的取值，与既有数据保持一致。

import type { GeomorphKind } from './geomorph.js'

export interface NoiseLayer { freq: number; amp: number }

export interface OpSpec {
  kind: GeomorphKind
  weight: number
  /** dune 用 */
  freq?: number
  /** dune 用 */
  angle?: number
  /** terrace 用 */
  steps?: number
  /** erode 用 */
  k?: number
}

export interface TerrainProfile {
  base: number
  noise: NoiseLayer[]
  ops: OpSpec[]
}

/** 键与 TERRAIN_MAP / OWNER_MAP 字符对应；'.' 为海洋，'*' 为无主陆地 */
export const TERRAIN_PROFILES: Record<string, TerrainProfile> = {
  '.': { base: -6, noise: [{ freq: 1.5, amp: 0.6 }], ops: [] },
  p: { base: 10, noise: [{ freq: 2, amp: 1.2 }, { freq: 6, amp: 0.4 }], ops: [] },
  f: { base: 13, noise: [{ freq: 3, amp: 1.8 }, { freq: 8, amp: 0.6 }], ops: [] },
  m: {
    base: 20,
    noise: [{ freq: 2.5, amp: 6 }, { freq: 7, amp: 2 }],
    ops: [{ kind: 'ridge', weight: 8 }, { kind: 'erode', weight: 1, k: 0.35 }],
  },
  c: { base: 5, noise: [{ freq: 3, amp: 0.8 }], ops: [] },
  i: {
    base: 11,
    noise: [{ freq: 2, amp: 2 }],
    ops: [{ kind: 'terrace', weight: 3, steps: 5 }],
  },
  r: { base: 5, noise: [{ freq: 9, amp: 1.6 }], ops: [] },
  v: { base: 24, noise: [{ freq: 2, amp: 4 }], ops: [{ kind: 'ridge', weight: 10 }] },
  d: {
    base: 9,
    noise: [{ freq: 2, amp: 1 }],
    ops: [{ kind: 'dune', weight: 4, freq: 10, angle: 0.6 }],
  },
  '*': { base: 8, noise: [{ freq: 2.5, amp: 1.4 }], ops: [] },
}
```

- [ ] **Step 4: 实现 heightfield.ts 的合成部分**

创建 `shared/src/world/heightfield.ts`：

```ts
// 论文 Eq.6 的高度场合成：
//   H(x) = Σ_r m_r(x) · [ h_r + Σ_k w_{r,k} N_{r,k}(x) + Σ_j λ_{r,j} G_{r,j}(x) ]
// 世界坐标以原点为中心，x ∈ [-sizeX/2, sizeX/2]，z ∈ [-sizeZ/2, sizeZ/2]。
// 掩膜是正方形采样，世界范围是矩形，两者通过归一化坐标 u/v 对应。

import { dune, erode, ridge, terrace } from './geomorph.js'
import { fbm, makeValueNoise2D } from './noise.js'
import { maskAt } from './masks.js'
import { mulberry32 } from './rng.js'
import { TERRAIN_PROFILES } from './profiles.js'
import type { RegionMasks } from './masks.js'
import type { TerrainProfile } from './profiles.js'

export { TERRAIN_PROFILES }
export type { TerrainProfile }

export interface Heightfield {
  res: number
  /** 世界 X 方向范围（three.js 单位） */
  sizeX: number
  /** 世界 Z 方向范围（three.js 单位） */
  sizeZ: number
  data: Float32Array
  min: number
  max: number
}

export function buildHeightfield(
  masks: RegionMasks,
  profiles: Record<string, TerrainProfile>,
  seed: number,
  sizeX: number,
  sizeZ: number,
): Heightfield {
  const res = masks.res
  const noise = makeValueNoise2D(mulberry32(seed))
  const data = new Float32Array(res * res)
  let min = Infinity
  let max = -Infinity

  for (let iy = 0; iy < res; iy++) {
    for (let ix = 0; ix < res; ix++) {
      // 归一化场坐标，乘 freq 得噪声域坐标
      const u = ix / (res - 1)
      const v = iy / (res - 1)
      let h = 0

      for (let r = 0; r < masks.keys.length; r++) {
        const w = maskAt(masks, r, ix, iy)
        if (w < 1e-4) continue
        const p = profiles[masks.keys[r]] ?? profiles.p

        let local = p.base
        for (const layer of p.noise) {
          local += layer.amp * fbm(noise, u * layer.freq, v * layer.freq, 4, 2, 0.5)
        }
        for (const op of p.ops) {
          const n = fbm(noise, u * (op.freq ?? 4), v * (op.freq ?? 4), 3, 2, 0.5)
          switch (op.kind) {
            case 'ridge':
              local += op.weight * ridge(n)
              break
            case 'terrace':
              local += op.weight * terrace((n + 1) / 2, op.steps ?? 4)
              break
            case 'dune':
              local += op.weight * dune(u, v, op.angle ?? 0, op.freq ?? 10)
              break
            case 'erode':
              local = erode(local, Math.abs(n), op.k ?? 0.3)
              break
          }
        }
        h += w * local
      }

      data[iy * res + ix] = h
      if (h < min) min = h
      if (h > max) max = h
    }
  }

  return { res, sizeX, sizeZ, data, min, max }
}
```

- [ ] **Step 5: 实现采样函数**

在 `shared/src/world/heightfield.ts` 继续追加：

```ts
/** 世界坐标 → 场索引（浮点），越界夹取 */
function toGrid(hf: Heightfield, x: number, z: number): [number, number] {
  const gx = ((x + hf.sizeX / 2) / hf.sizeX) * (hf.res - 1)
  const gz = ((z + hf.sizeZ / 2) / hf.sizeZ) * (hf.res - 1)
  return [
    Math.min(hf.res - 1, Math.max(0, gx)),
    Math.min(hf.res - 1, Math.max(0, gz)),
  ]
}

/** 双线性采样。用于落点高度、散布高度查询。 */
export function sampleHeight(hf: Heightfield, x: number, z: number): number {
  const [gx, gz] = toGrid(hf, x, z)
  const x0 = Math.floor(gx)
  const z0 = Math.floor(gz)
  const x1 = Math.min(hf.res - 1, x0 + 1)
  const z1 = Math.min(hf.res - 1, z0 + 1)
  const tx = gx - x0
  const tz = gz - z0
  const h00 = hf.data[z0 * hf.res + x0]
  const h10 = hf.data[z0 * hf.res + x1]
  const h01 = hf.data[z1 * hf.res + x0]
  const h11 = hf.data[z1 * hf.res + x1]
  const top = h00 + (h10 - h00) * tx
  const bot = h01 + (h11 - h01) * tx
  return top + (bot - top) * tz
}

/**
 * 按渲染网格的三角剖分插值。渲染网格分辨率低于高度场，
 * 这个函数模拟射线打到实际三角面的结果，用于验证拾取落点与解析采样一致。
 */
export function sampleHeightOnMesh(
  hf: Heightfield,
  x: number,
  z: number,
  meshRes: number,
): number {
  const halfX = hf.sizeX / 2
  const halfZ = hf.sizeZ / 2
  const cellX = hf.sizeX / (meshRes - 1)
  const cellZ = hf.sizeZ / (meshRes - 1)
  const cx = Math.min(meshRes - 2, Math.max(0, Math.floor((x + halfX) / cellX)))
  const cz = Math.min(meshRes - 2, Math.max(0, Math.floor((z + halfZ) / cellZ)))
  const fx = Math.min(1, Math.max(0, (x + halfX) / cellX - cx))
  const fz = Math.min(1, Math.max(0, (z + halfZ) / cellZ - cz))

  const at = (i: number, j: number) =>
    sampleHeight(hf, -halfX + i * cellX, -halfZ + j * cellZ)

  const h00 = at(cx, cz)
  const h10 = at(cx + 1, cz)
  const h01 = at(cx, cz + 1)
  const h11 = at(cx + 1, cz + 1)

  // 三角剖分沿对角线 fx + fz = 1 切分
  if (fx + fz <= 1) {
    return h00 + (h10 - h00) * fx + (h01 - h00) * fz
  }
  return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz)
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `npx vitest run shared/src/world/heightfield.test.ts`
Expected: PASS，8 个用例全绿

注意：不要试图让「解析采样」与「网格插值」在任意点上数值相等。`ridge` 与 `terrace`
刻意制造锐利折线和阶跃，粗网格在几何上就无法在任意点复现它们——这是地貌的意义，不是缺陷。
两者只在网格顶点处严格相等，单元内部则各自是合法插值。物体落点的一致性由 Task 7 保证：
落点直接采用网格插值。

- [ ] **Step 7: 提交**

```bash
git add shared/src/world/profiles.ts shared/src/world/heightfield.ts shared/src/world/heightfield.test.ts
git commit -m "feat: Eq.6 高度场合成与双线性/三角插值采样"
```

---

### Task 5: 资产编码与烘焙 CLI

**Files:**
- Create: `shared/src/world/codec.ts`
- Create: `shared/src/world/index.ts`
- Create: `tools/bake-world.ts`
- Modify: `package.json`（根，新增 `bake:world` 脚本）
- Test: `shared/src/world/codec.test.ts`

**Interfaces:**
- Consumes: Task 3 的 `RegionMasks` / `dominantRegion`，Task 4 的 `Heightfield` / `buildHeightfield` / `TERRAIN_PROFILES`
- Produces:
  - `interface WorldSpec { res: number; meshRes: number; sizeX: number; sizeZ: number; seed: number; min: number; max: number; regions: string[]; owners: string[] }`
  - `encodeHeights(hf: Heightfield): Uint16Array`
  - `decodeHeights(buf: Uint16Array, min: number, max: number): Float32Array`
  - `encodeRegions(masks: RegionMasks): Uint8Array`
  - `shared/src/world/index.ts` 重导出本目录全部公共 API

- [ ] **Step 1: 写失败的测试**

创建 `shared/src/world/codec.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { buildMasks } from './masks.js'
import { TERRAIN_PROFILES, buildHeightfield } from './heightfield.js'
import { decodeHeights, encodeHeights, encodeRegions } from './codec.js'

const ROWS = ['ppmm', 'ppmm', 'ccii', 'ccii']
const masks = buildMasks(ROWS, 32, 2)
const hf = buildHeightfield(masks, TERRAIN_PROFILES, 42, 400, 250)

describe('高度图量化', () => {
  it('往返误差不超过量化步长', () => {
    const dec = decodeHeights(encodeHeights(hf), hf.min, hf.max)
    const step = (hf.max - hf.min) / 65535
    expect(dec.length).toBe(hf.data.length)
    for (let i = 0; i < hf.data.length; i++) {
      expect(Math.abs(dec[i] - hf.data[i])).toBeLessThanOrEqual(step)
    }
  })

  it('编码结果落在 Uint16 范围', () => {
    for (const v of encodeHeights(hf)) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(65535)
    }
  })
})

describe('区域图编码', () => {
  it('长度等于像素数且索引合法', () => {
    const enc = encodeRegions(masks)
    expect(enc.length).toBe(masks.res * masks.res)
    for (const v of enc) expect(v).toBeLessThan(masks.keys.length)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run shared/src/world/codec.test.ts`
Expected: FAIL，`Cannot find module './codec.js'`

- [ ] **Step 3: 实现 codec.ts**

创建 `shared/src/world/codec.ts`：

```ts
// 烘焙资产的二进制编码。刻意不引 PNG 依赖：
// 高度走 Uint16 线性量化，区域走 Uint8 索引，元信息全在 world-spec.json 里。

import { dominantRegion } from './masks.js'
import type { RegionMasks } from './masks.js'
import type { Heightfield } from './heightfield.js'

export interface WorldSpec {
  res: number
  meshRes: number
  sizeX: number
  sizeZ: number
  seed: number
  min: number
  max: number
  /** 地形区域键，顺序与 regions.bin 的索引一致 */
  regions: string[]
  /** 归属区域键，顺序与 owners.bin 的索引一致 */
  owners: string[]
}

export function encodeHeights(hf: Heightfield): Uint16Array {
  const span = hf.max - hf.min
  const out = new Uint16Array(hf.data.length)
  for (let i = 0; i < hf.data.length; i++) {
    const t = span > 0 ? (hf.data[i] - hf.min) / span : 0
    out[i] = Math.round(Math.min(1, Math.max(0, t)) * 65535)
  }
  return out
}

export function decodeHeights(buf: Uint16Array, min: number, max: number): Float32Array {
  const span = max - min
  const out = new Float32Array(buf.length)
  for (let i = 0; i < buf.length; i++) out[i] = min + (buf[i] / 65535) * span
  return out
}

export function encodeRegions(masks: RegionMasks): Uint8Array {
  const out = new Uint8Array(masks.res * masks.res)
  for (let iy = 0; iy < masks.res; iy++) {
    for (let ix = 0; ix < masks.res; ix++) {
      out[iy * masks.res + ix] = dominantRegion(masks, ix, iy)
    }
  }
  return out
}
```

- [ ] **Step 4: 实现 index.ts**

创建 `shared/src/world/index.ts`：

```ts
export * from './rng.js'
export * from './noise.js'
export * from './geomorph.js'
export * from './masks.js'
export * from './profiles.js'
export * from './heightfield.js'
export * from './codec.js'
```

- [ ] **Step 5: 实现烘焙 CLI**

创建 `tools/bake-world.ts`：

```ts
// 离线烘焙：ASCII 图 → 区域掩膜 → Eq.6 高度场 → web/public/world/ 静态资产。
// 运行：npm run bake:world

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OWNER_MAP, TERRAIN_MAP } from '../shared/src/data.js'
import {
  TERRAIN_PROFILES, buildHeightfield, buildMasks, encodeHeights, encodeRegions,
} from '../shared/src/world/index.js'
import type { WorldSpec } from '../shared/src/world/index.js'

const RES = 512
const MESH_RES = 256
const SIZE_X = 400
const SIZE_Z = 250
const SOFTNESS = 6
const SEED = 20260818

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'web/public/world')

const terrainMasks = buildMasks(TERRAIN_MAP, RES, SOFTNESS)
const ownerMasks = buildMasks(OWNER_MAP, RES, SOFTNESS)
const hf = buildHeightfield(terrainMasks, TERRAIN_PROFILES, SEED, SIZE_X, SIZE_Z)

const spec: WorldSpec = {
  res: RES,
  meshRes: MESH_RES,
  sizeX: SIZE_X,
  sizeZ: SIZE_Z,
  seed: SEED,
  min: hf.min,
  max: hf.max,
  regions: terrainMasks.keys,
  owners: ownerMasks.keys,
}

mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, 'heightmap.bin'), Buffer.from(encodeHeights(hf).buffer))
writeFileSync(resolve(outDir, 'regions.bin'), Buffer.from(encodeRegions(terrainMasks).buffer))
writeFileSync(resolve(outDir, 'owners.bin'), Buffer.from(encodeRegions(ownerMasks).buffer))
writeFileSync(resolve(outDir, 'world-spec.json'), JSON.stringify(spec, null, 2))

console.log(`烘焙完成 -> ${outDir}`)
console.log(`  采样 ${RES}  世界 ${SIZE_X}x${SIZE_Z}  高度 ${hf.min.toFixed(2)} ~ ${hf.max.toFixed(2)}`)
console.log(`  地形区 ${terrainMasks.keys.join('')}  归属区 ${ownerMasks.keys.join('')}`)
```

在根 `package.json` 的 `scripts` 里新增一行（放在 `build` 之后）：

```json
    "bake:world": "tsx tools/bake-world.ts",
```

- [ ] **Step 6: 运行测试与烘焙确认通过**

Run: `npx vitest run shared/src/world/codec.test.ts`
Expected: PASS，3 个用例全绿

Run: `npm run bake:world`
Expected: 打印「烘焙完成」，`web/public/world/` 下出现 4 个文件，`heightmap.bin` 约 512KB、`regions.bin` 与 `owners.bin` 各约 256KB

- [ ] **Step 7: 提交**

```bash
git add shared/src/world/codec.ts shared/src/world/codec.test.ts shared/src/world/index.ts tools/bake-world.ts package.json web/public/world
git commit -m "feat: 世界资产编码与离线烘焙 CLI"
```

---

### Task 6: 浏览器端加载与地形渲染

**Files:**
- Create: `web/src/world/loadWorld.ts`
- Create: `web/src/world/TerrainMesh.tsx`
- Create: `web/src/world/WorldCanvas.tsx`
- Modify: `shared/package.json`（新增 `./world` 导出子路径）
- Modify: `web/src/App.tsx`（临时验证用，Task 8 会正式接线）

**Interfaces:**
- Consumes: Task 5 的 `WorldSpec` / `decodeHeights`，Task 4 的 `Heightfield` / `sampleHeight`
- Produces:
  - `interface LoadedWorld { spec: WorldSpec; heights: Float32Array; regions: Uint8Array; owners: Uint8Array; hf: Heightfield }`
  - `loadWorld(baseUrl?: string): Promise<LoadedWorld>`
  - `TerrainMesh(props: { world: LoadedWorld; onPick?: (point: THREE.Vector3, normal: THREE.Vector3) => void })`
  - `WorldCanvas(props: { world: LoadedWorld; onPick?: (point: THREE.Vector3, normal: THREE.Vector3) => void })`

- [ ] **Step 1: 开放 shared 子路径导出**

修改 `shared/package.json` 的 `exports` 字段为：

```json
  "exports": {
    ".": "./src/index.ts",
    "./world": "./src/world/index.ts"
  },
```

- [ ] **Step 2: 实现资产加载**

创建 `web/src/world/loadWorld.ts`：

```ts
// 加载烘焙产物。渲染层不重算高度场，只消费资产。

import { decodeHeights } from '@gbn/shared/world'
import type { Heightfield, WorldSpec } from '@gbn/shared/world'

export interface LoadedWorld {
  spec: WorldSpec
  heights: Float32Array
  regions: Uint8Array
  owners: Uint8Array
  hf: Heightfield
}

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`加载失败 ${url}: ${res.status}`)
  return res.arrayBuffer()
}

export async function loadWorld(baseUrl = '/world'): Promise<LoadedWorld> {
  const specRes = await fetch(`${baseUrl}/world-spec.json`)
  if (!specRes.ok) throw new Error(`加载 world-spec.json 失败: ${specRes.status}`)
  const spec: WorldSpec = await specRes.json()

  const [hBuf, rBuf, oBuf] = await Promise.all([
    fetchBuffer(`${baseUrl}/heightmap.bin`),
    fetchBuffer(`${baseUrl}/regions.bin`),
    fetchBuffer(`${baseUrl}/owners.bin`),
  ])

  const heights = decodeHeights(new Uint16Array(hBuf), spec.min, spec.max)
  const hf: Heightfield = {
    res: spec.res,
    sizeX: spec.sizeX,
    sizeZ: spec.sizeZ,
    data: heights,
    min: spec.min,
    max: spec.max,
  }

  return { spec, heights, regions: new Uint8Array(rBuf), owners: new Uint8Array(oBuf), hf }
}
```

- [ ] **Step 3: 实现地形网格**

创建 `web/src/world/TerrainMesh.tsx`：

```tsx
// 地形网格：PlaneGeometry 按高度场位移。网格分辨率低于高度场分辨率，
// 位移用 sampleHeight 取值，与 shared 的解析采样保持一致。

import { sampleHeight } from '@gbn/shared/world'
import { useMemo } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { LoadedWorld } from './loadWorld'

interface Props {
  world: LoadedWorld
  onPick?: (point: THREE.Vector3, normal: THREE.Vector3) => void
}

export function TerrainMesh({ world, onPick }: Props) {
  const geometry = useMemo(() => {
    const { sizeX, sizeZ, meshRes } = world.spec
    const geo = new THREE.PlaneGeometry(sizeX, sizeZ, meshRes - 1, meshRes - 1)
    geo.rotateX(-Math.PI / 2)   // 平面转到 xz 面，y 作高度
    const pos = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, sampleHeight(world.hf, pos.getX(i), pos.getZ(i)))
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
    return geo
  }, [world])

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!onPick) return
    e.stopPropagation()
    const normal = e.face
      ? e.face.normal.clone().transformDirection(e.object.matrixWorld)
      : new THREE.Vector3(0, 1, 0)
    onPick(e.point.clone(), normal)
  }

  return (
    <mesh geometry={geometry} onClick={handleClick} receiveShadow castShadow>
      <meshStandardMaterial color="#5d7a8c" />
    </mesh>
  )
}
```

- [ ] **Step 4: 实现画布**

创建 `web/src/world/WorldCanvas.tsx`：

```tsx
// 世界画布：轨道相机 + 基础光照 + 地形。

import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import type * as THREE from 'three'
import { TerrainMesh } from './TerrainMesh'
import type { LoadedWorld } from './loadWorld'

interface Props {
  world: LoadedWorld
  onPick?: (point: THREE.Vector3, normal: THREE.Vector3) => void
}

export function WorldCanvas({ world, onPick }: Props) {
  const { sizeX, sizeZ } = world.spec
  const span = Math.max(sizeX, sizeZ)
  return (
    <Canvas
      shadows
      camera={{ position: [span * 0.6, span * 0.5, span * 0.6], fov: 45, far: span * 5 }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#0b1a2b']} />
      <hemisphereLight args={['#cfe6ff', '#22303d', 0.7]} />
      <directionalLight position={[span * 0.4, span * 0.8, span * 0.3]} intensity={1.4} castShadow />
      <TerrainMesh world={world} onPick={onPick} />
      <OrbitControls makeDefault enableDamping target={[0, 0, 0]} />
    </Canvas>
  )
}
```

- [ ] **Step 5: 临时接线，肉眼验证**

把 `web/src/App.tsx` 的内容整体替换为下面这段（Task 8 会恢复完整面板，这一步只为看到画面）。
先备份原文件：`cp web/src/App.tsx web/src/App.tsx.bak`

```tsx
import { useEffect, useState } from 'react'
import { WorldCanvas } from './world/WorldCanvas'
import { loadWorld } from './world/loadWorld'
import type { LoadedWorld } from './world/loadWorld'

export default function App() {
  const [world, setWorld] = useState<LoadedWorld | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { loadWorld().then(setWorld).catch(e => setErr(String(e))) }, [])
  if (err) return <div style={{ padding: 24, color: '#f66' }}>{err}</div>
  if (!world) return <div style={{ padding: 24 }}>加载世界…</div>
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <WorldCanvas world={world} onPick={(pt, n) => console.log('落点', pt, '法线', n)} />
    </div>
  )
}
```

Run: `npm run dev:web`，浏览器打开 http://localhost:5173/
Expected: 看到一块连续起伏的大陆，可拖拽旋转、滚轮缩放；右上角山地明显高于左下海岸；点击地形时控制台打印落点与法线

- [ ] **Step 6: 提交**

```bash
git add web/src/world shared/package.json web/src/App.tsx
git commit -m "feat: 浏览器端世界加载与地形渲染"
```

---

### Task 7: 落点解析与 GLB 归一化

**Files:**
- Create: `shared/src/world/placement.ts`
- Test: `shared/src/world/placement.test.ts`
- Create: `web/src/world/placement.ts`
- Modify: `shared/src/world/index.ts`（导出 placement）

**Interfaces:**
- Consumes: Task 4 的 `Heightfield` / `sampleHeight` / `sampleHeightOnMesh`
- Produces:
  - `interface Placement { x: number; y: number; z: number; nx: number; ny: number; nz: number }`
  - `placementAt(hf: Heightfield, x: number, z: number): Placement`（shared，纯函数）
  - `normalizeToHeight(object: THREE.Object3D, targetHeight: number): void`（web）
  - `alignToNormal(object: THREE.Object3D, p: Placement): void`（web）

- [ ] **Step 1: 写失败的测试**

创建 `shared/src/world/placement.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { buildMasks } from './masks.js'
import { TERRAIN_PROFILES, buildHeightfield, sampleHeightOnMesh } from './heightfield.js'
import { placementAt } from './placement.js'

const MESH_RES = 256

const hf = buildHeightfield(
  buildMasks(['ppmm', 'ppmm', 'ccii', 'ccii'], 64, 3),
  TERRAIN_PROFILES, 2026, 400, 250,
)

describe('placementAt', () => {
  it('落点高度与渲染网格插值逐位一致', () => {
    // 本模块存在的意义：物体必须精确坐在看得见的地面上，不悬浮也不陷入
    for (const [x, z] of [[12, -34], [0, 0], [77.5, 41.25], [-150, 100]]) {
      expect(placementAt(hf, x, z, MESH_RES).y)
        .toBe(sampleHeightOnMesh(hf, x, z, MESH_RES))
    }
  })

  it('法线是单位向量', () => {
    const p = placementAt(hf, 40, 40, MESH_RES)
    expect(Math.hypot(p.nx, p.ny, p.nz)).toBeCloseTo(1, 6)
  })

  it('法线朝上', () => {
    for (const [x, z] of [[0, 0], [50, -80], [-120, 90]]) {
      expect(placementAt(hf, x, z, MESH_RES).ny).toBeGreaterThan(0)
    }
  })

  it('陡坡处法线明显偏离竖直，平坦处接近竖直', () => {
    let steepest = 1
    let flattest = 0
    for (let i = 0; i < 400; i++) {
      const x = -hf.sizeX / 2 + ((i * 7.3) % hf.sizeX)
      const z = -hf.sizeZ / 2 + ((i * 11.7) % hf.sizeZ)
      const ny = placementAt(hf, x, z, MESH_RES).ny
      steepest = Math.min(steepest, ny)
      flattest = Math.max(flattest, ny)
    }
    expect(steepest).toBeLessThan(0.99)
    expect(flattest).toBeGreaterThan(0.999)
  })

  it('越界坐标不产生 NaN', () => {
    const p = placementAt(hf, 99999, -99999, MESH_RES)
    expect(Number.isFinite(p.y)).toBe(true)
    expect(Number.isFinite(p.nx)).toBe(true)
    expect(Number.isFinite(p.nz)).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run shared/src/world/placement.test.ts`
Expected: FAIL，`Cannot find module './placement.js'`

- [ ] **Step 3: 实现 shared 侧落点计算**

创建 `shared/src/world/placement.ts`：

```ts
// 落点计算。论文 Eq.10–13 要从 2D 构图反解物体位姿，
// 我们的地形是自有高度场，落点与法线可以直接求得。
//
// 高度取自 sampleHeightOnMesh：ridge/terrace 刻意制造锐利折线与阶跃，
// 解析场与渲染网格在单元内部本就不相等，物体必须坐在「看得见的那个面」上。
// 法线则取自解析场的中心差分——三角面片法线是分片常量，直接用会让物体朝向
// 在跨越面片时突跳。

import { sampleHeight, sampleHeightOnMesh } from './heightfield.js'
import type { Heightfield } from './heightfield.js'

export interface Placement {
  x: number
  y: number
  z: number
  nx: number
  ny: number
  nz: number
}

export function placementAt(
  hf: Heightfield,
  x: number,
  z: number,
  meshRes: number,
): Placement {
  const epsX = hf.sizeX / (hf.res - 1)
  const epsZ = hf.sizeZ / (hf.res - 1)
  const y = sampleHeightOnMesh(hf, x, z, meshRes)

  // 中心差分求梯度，法线 = normalize(-dh/dx, 1, -dh/dz)
  const dhdx = (sampleHeight(hf, x + epsX, z) - sampleHeight(hf, x - epsX, z)) / (2 * epsX)
  const dhdz = (sampleHeight(hf, x, z + epsZ) - sampleHeight(hf, x, z - epsZ)) / (2 * epsZ)
  const len = Math.hypot(-dhdx, 1, -dhdz)

  return { x, y, z, nx: -dhdx / len, ny: 1 / len, nz: -dhdz / len }
}
```

在 `shared/src/world/index.ts` 末尾追加一行：

```ts
export * from './placement.js'
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run shared/src/world/placement.test.ts`
Expected: PASS，5 个用例全绿

- [ ] **Step 5: 实现 web 侧归一化与对齐**

创建 `web/src/world/placement.ts`：

```ts
// GLB 归一化与落地对齐。生成模型的尺寸与原点约定各不相同，
// 不归一化会出现巨大化或穿模，这是接入任何 3D 生成 API 的必备前处理。

import * as THREE from 'three'
import type { Placement } from '@gbn/shared/world'

/** 量包围盒 → 缩放到目标高度 → 原点移到底面中心 */
export function normalizeToHeight(object: THREE.Object3D, targetHeight: number): void {
  const box = new THREE.Box3().setFromObject(object)
  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  box.getSize(size)
  box.getCenter(center)

  object.position.sub(new THREE.Vector3(center.x, box.min.y, center.z))
  object.scale.setScalar(targetHeight / Math.max(size.y, 1e-4))
}

/** 把物体摆到落点并贴合地表法线 */
export function alignToNormal(object: THREE.Object3D, p: Placement): void {
  object.position.set(p.x, p.y, p.z)
  const up = new THREE.Vector3(0, 1, 0)
  const n = new THREE.Vector3(p.nx, p.ny, p.nz).normalize()
  object.quaternion.setFromUnitVectors(up, n)
}
```

- [ ] **Step 6: 为归一化补测试**

three.js 的 `Box3` / `Object3D` 不需要 WebGL，可以直接在 node 下测。
创建 `web/src/world/placement.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { alignToNormal, normalizeToHeight } from './placement'

/** 造一个任意尺寸、原点不在底面中心的盒子 */
function boxAt(w: number, h: number, d: number, offset: THREE.Vector3) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d))
  mesh.position.copy(offset)
  const group = new THREE.Group()
  group.add(mesh)
  group.updateMatrixWorld(true)
  return group
}

describe('normalizeToHeight', () => {
  it('任意尺寸都缩放到目标高度', () => {
    for (const [w, h, d] of [[1, 1, 1], [0.02, 0.05, 0.02], [300, 900, 120]]) {
      const obj = boxAt(w, h, d, new THREE.Vector3(0, 0, 0))
      normalizeToHeight(obj, 12)
      obj.updateMatrixWorld(true)
      const size = new THREE.Vector3()
      new THREE.Box3().setFromObject(obj).getSize(size)
      expect(size.y).toBeCloseTo(12, 4)
    }
  })

  it('原点偏移的模型归一化后底面落在 y=0', () => {
    const obj = boxAt(4, 8, 4, new THREE.Vector3(17, -33, 9))
    normalizeToHeight(obj, 10)
    obj.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(obj)
    expect(box.min.y).toBeCloseTo(0, 4)
    expect(box.getCenter(new THREE.Vector3()).x).toBeCloseTo(0, 4)
    expect(box.getCenter(new THREE.Vector3()).z).toBeCloseTo(0, 4)
  })
})

describe('alignToNormal', () => {
  it('竖直法线不产生旋转', () => {
    const obj = new THREE.Object3D()
    alignToNormal(obj, { x: 3, y: 7, z: -2, nx: 0, ny: 1, nz: 0 })
    expect(obj.position.toArray()).toEqual([3, 7, -2])
    expect(obj.quaternion.angleTo(new THREE.Quaternion())).toBeCloseTo(0, 6)
  })

  it('倾斜法线把物体的 up 轴转到法线方向', () => {
    const obj = new THREE.Object3D()
    const n = new THREE.Vector3(0.5, 0.8, -0.3).normalize()
    alignToNormal(obj, { x: 0, y: 0, z: 0, nx: n.x, ny: n.y, nz: n.z })
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(obj.quaternion)
    expect(up.angleTo(n)).toBeCloseTo(0, 6)
  })
})
```

Run: `npx vitest run web/src/world/placement.test.ts`
Expected: PASS，4 个用例全绿

- [ ] **Step 7: 提交**

```bash
git add shared/src/world/placement.ts shared/src/world/placement.test.ts shared/src/world/index.ts web/src/world/placement.ts web/src/world/placement.test.ts
git commit -m "feat: 落点解析计算与 GLB 归一化对齐"
```

---

### Task 8: 拆除六角格并正式接线

**Files:**
- Delete: `shared/src/hex.ts`、`shared/src/hex.test.ts`、`shared/src/territory.ts`、`web/src/map/geometry.ts`、`web/src/map/HexMap.tsx`、`web/src/panels/ClaimPanel.tsx`
- Modify: `shared/src/index.ts`、`web/src/state/store.ts`、`web/src/state/types.ts`、`web/src/App.tsx`、`web/src/panels/CellPanel.tsx`

**Interfaces:**
- Consumes: Task 6 的 `loadWorld` / `WorldCanvas` / `LoadedWorld`，Task 7 的 `placementAt` / `Placement`
- Produces: `AppState` 以 `selectedPlacement: Placement | null` 取代 `selectedCell: string | null`；`Action` 以 `{ type: 'pickPlacement'; placement: Placement }` 取代 `pickCell` 与 `resolveDispute`

- [ ] **Step 1: 记录基线并列出引用点**

Run: `npx vitest run`
记下当前通过用例数（此时六角测试 22 项仍在，加上新写的 world 测试）

Run: `grep -rn "hex\|territory\|buildCells\|cellKey\|HexMap\|ClaimPanel\|MapMode" shared/src web/src --include=*.ts --include=*.tsx`
Expected: 打印全部待改引用，作为本任务的操作清单

- [ ] **Step 2: 恢复 App 并删除六角模块**

```bash
mv web/src/App.tsx.bak web/src/App.tsx
git rm shared/src/hex.ts shared/src/hex.test.ts shared/src/territory.ts
git rm web/src/map/geometry.ts web/src/map/HexMap.tsx
git rm web/src/panels/ClaimPanel.tsx
```

把 `shared/src/index.ts` 改为：

```ts
export * from './types.js'
export * from './data.js'
export * from './world/index.js'
```

- [ ] **Step 3: 改状态层**

在 `web/src/state/store.ts` 中：

- 顶部 import 改为
  ```ts
  import { AI_POOL, LANDMARKS, ROLES, TERRAIN, nationById } from '@gbn/shared'
  import type { DraftKind, Landmark, Nation, Placement, QueueItem, QueueKind, RoleKey } from '@gbn/shared'
  import type { LayerKey, ViewMode } from './types'
  ```
- `AppState` 删除 `selectedCell`、`mode`、`draft`、`cells`、`resolvedDisputes` 五个字段，新增 `selectedPlacement: Placement | null`
- `initialState` 对应删除 `selectedCell: null`、`mode: 'inspect'`、`draft: new Set()`、`cells: buildCells()`、`resolvedDisputes: new Set()`，新增 `selectedPlacement: null`
- `Action` 联合类型删除 `pickCell`、`setMode`、`resolveDispute` 三支，新增 `| { type: 'pickPlacement'; placement: Placement }`
- `reducer` 删除 `pickCell`、`setMode`、`resolveDispute` 三个 case，新增：
  ```ts
    case 'pickPlacement':
      return { ...s, selectedPlacement: a.placement }
  ```
- `reducer` 中 `setRole` 分支去掉 `draft: new Set(), mode: 'inspect'`，只保留 `role: a.role`
- `decide` 分支里所有读写 `cells` 的代码整段删除（`terrain` 与 `claim` 两处），保留 `landmark` / `texture` / `story` 的处理；`draft` 相关赋值一并删除

在 `web/src/state/types.ts` 中删除 `MapMode` 类型定义（圈地玩法随领土算法一并移除），保留 `LayerKey` 与 `ViewMode`。

- [ ] **Step 4: 改 CellPanel 为落点面板**

把 `web/src/panels/CellPanel.tsx` 的展示内容改为读 `state.selectedPlacement`：无选点时提示「点击地形选点」，有选点时显示：

```tsx
      <div className="s10 tm">坐标 X {p.x.toFixed(1)} · Z {p.z.toFixed(1)}</div>
      <div className="s10 tm">高度 {p.y.toFixed(2)}</div>
      <div className="s10 tm">坡度 {(Math.acos(p.ny) * 180 / Math.PI).toFixed(1)}°</div>
```

- [ ] **Step 5: 改 App 接线**

在 `web/src/App.tsx` 顶部新增：

```tsx
import { useEffect, useState } from 'react'
import { placementAt } from '@gbn/shared/world'
import { WorldCanvas } from './world/WorldCanvas'
import { loadWorld } from './world/loadWorld'
import type { LoadedWorld } from './world/loadWorld'
```

在组件内加载世界：

```tsx
  const [world, setWorld] = useState<LoadedWorld | null>(null)
  useEffect(() => { loadWorld().then(setWorld).catch(() => setWorld(null)) }, [])
```

把原来的地图区域整块替换为：

```tsx
              <div className="map-stage" style={{ position: 'relative' }}>
                {world
                  ? (
                    <WorldCanvas
                      world={world}
                      onPick={pt => dispatch({
                        type: 'pickPlacement',
                        placement: placementAt(world.hf, pt.x, pt.z, world.spec.meshRes),
                      })}
                    />
                    )
                  : <div className="s10 tm" style={{ padding: 24 }}>加载世界…</div>}
                <div className="map-hint">左键拖拽旋转 · 滚轮缩放 · 点击地形选点</div>
              </div>
```

删除 `App.tsx` 里对 `HexMap`、`ClaimPanel`、`CONTESTED`、`borderSegments`、`cellKey`、`MAP_W`、`MAP_H` 的 import 与全部使用点；右侧 `stack` 中移除 `<ClaimPanel ... />`。

- [ ] **Step 6: 全量验证**

Run: `npx vitest run`
Expected: PASS，只剩 world 测试共 46 个用例（noise 8 + geomorph 13 + masks 5 + heightfield 8 + codec 3 + shared placement 5 + web placement 4），六角相关用例全部消失

Run: `npm run build`
Expected: 构建成功，无 TypeScript 报错

Run: `npm run dev:web` 并打开页面
Expected: 连续地形世界渲染正常；点击地形后左侧面板显示落点坐标、高度、坡度；身份切换、排行榜、AI 工坊、审核队列等既有面板功能不受影响

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "refactor: 拆除六角格网格，正式接入连续地形世界"
```

---

## 完成标准

- `npx vitest run` 全绿，覆盖高度场确定性、掩膜权重和、边界软化宽度、放置正确性、落点法线
- `npm run bake:world` 可重复执行且产出逐字节一致（种子固定）
- 浏览器中可见连续起伏的大陆，可旋转缩放，点击任意点得到正确落点与法线
- `shared/src/world/` 全部模块不依赖 three.js 与浏览器 API

## 后续计划（不在本计划内）

- **层 2 计划**：GPT 规划 agent 产出 `NationStyleSpec`、GPT-Image 产地表纹理与国徽、程序化散布原型、splat 材质按 `owners.bin` 分国着色
- **层 3 计划**：`MeshSource` 适配层、程序化占位实现、Tripo v3 驱动（待 key）、地标生成与审核接线
