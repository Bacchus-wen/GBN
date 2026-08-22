import { describe, expect, it } from 'vitest'
import { buildMasks } from './masks'
import {
  TERRAIN_PROFILES, buildHeightfield, sampleHeight, sampleHeightOnMesh,
} from './heightfield'

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

describe('垂直夸张', () => {
  it('verticalScale 线性缩放整个高度场', () => {
    const a = buildHeightfield(buildMasks(ROWS, 64, 3), TERRAIN_PROFILES, 5, 400, 250)
    const b = buildHeightfield(buildMasks(ROWS, 64, 3), TERRAIN_PROFILES, 5, 400, 250, 2.5)
    for (let i = 0; i < a.data.length; i += 97) {
      expect(b.data[i]).toBeCloseTo(a.data[i] * 2.5, 4)
    }
    expect(b.min).toBeCloseTo(a.min * 2.5, 4)
    expect(b.max).toBeCloseTo(a.max * 2.5, 4)
  })

  it('省略时默认不缩放', () => {
    const a = buildHeightfield(buildMasks(ROWS, 64, 3), TERRAIN_PROFILES, 5, 400, 250)
    const b = buildHeightfield(buildMasks(ROWS, 64, 3), TERRAIN_PROFILES, 5, 400, 250, 1)
    expect(Array.from(b.data)).toEqual(Array.from(a.data))
  })
})

describe('各向同性', () => {
  // 掩膜是正方形采样、世界是矩形，若噪声直接吃归一化的 u/v，同一个 freq 在 X 方向的
  // 世界波长会是 Z 的 sizeX/sizeZ 倍，地表纹理被东西向拉长。修正前实测坡度比为
  // 1.67~1.91；这里用多种子平均压掉单种子的采样方差（单种子散布约 ±0.15）。
  const slopeRatio = (key: string, seed: number) => {
    const rows = Array.from({ length: 6 }, () => key.repeat(8))
    const hf = buildHeightfield(buildMasks(rows, 128, 3), TERRAIN_PROFILES, seed, 400, 250)
    let sx = 0
    let sz = 0
    for (let i = 0; i < 4000; i++) {
      const x = -150 + ((i * 7.3) % 300)
      const z = -90 + ((i * 11.7) % 180)
      sx += Math.abs(sampleHeight(hf, x + 1, z) - sampleHeight(hf, x - 1, z))
      sz += Math.abs(sampleHeight(hf, x, z + 1) - sampleHeight(hf, x, z - 1))
    }
    return sz / sx
  }

  it.each(['p', 'f', 'm', 'i'])('%s 区的东西/南北坡度比接近 1', (key) => {
    let sum = 0
    const seeds = 8
    for (let seed = 1; seed <= seeds; seed++) sum += slopeRatio(key, seed)
    const mean = sum / seeds
    expect(mean).toBeGreaterThan(0.88)
    expect(mean).toBeLessThan(1.14)
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
