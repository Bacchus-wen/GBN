// 论文 Eq.6 的高度场合成：
//   H(x) = Σ_r m_r(x) · [ h_r + Σ_k w_{r,k} N_{r,k}(x) + Σ_j λ_{r,j} G_{r,j}(x) ]
// 世界坐标以原点为中心，x ∈ [-sizeX/2, sizeX/2]，z ∈ [-sizeZ/2, sizeZ/2]。
// 掩膜是正方形采样，世界范围是矩形，两者通过归一化坐标 u/v 对应。
//
// verticalScale 是显式的垂直夸张系数。profiles 里的 base 沿用 data.ts 的 TERRAIN.height
// （也是界面图例上显示的数字），但那点起伏铺在数百单位宽的地面上几乎看不出来。
// 与其偷偷调高基准高程让图例说谎，不如把夸张作为一个具名参数留在烘焙侧。

import { dune, erode, ridge, terrace } from './geomorph'
import { fbm, makeValueNoise2D } from './noise'
import { maskAt } from './masks'
import { mulberry32 } from './rng'
import { TERRAIN_PROFILES } from './profiles'
import type { RegionMasks } from './masks'
import type { TerrainProfile } from './profiles'

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
  verticalScale = 1,
): Heightfield {
  const res = masks.res
  const noise = makeValueNoise2D(mulberry32(seed))
  const data = new Float32Array(res * res)
  let min = Infinity
  let max = -Infinity

  // 噪声域坐标必须各向同性：掩膜是正方形采样，世界是矩形，直接用归一化的
  // u/v 会让同一个 freq 在 X 方向的世界波长是 Z 的 sizeX/sizeZ 倍，地表纹理被拉长。
  // 用几何平均作参考长度，使两个方向的世界波长都等于 ref/freq，且整体尺度感与
  // 修正前接近（介于原来的 sizeX/freq 与 sizeZ/freq 之间）。
  const ref = Math.sqrt(sizeX * sizeZ)
  const spanU = sizeX / ref
  const spanV = sizeZ / ref

  for (let iy = 0; iy < res; iy++) {
    for (let ix = 0; ix < res; ix++) {
      // u/v 用于掩膜索引对应的归一化位置，nu/nv 是各向同性的噪声域坐标
      const u = ix / (res - 1)
      const v = iy / (res - 1)
      const nu = u * spanU
      const nv = v * spanV
      let h = 0

      for (let r = 0; r < masks.keys.length; r++) {
        const w = maskAt(masks, r, ix, iy)
        if (w < 1e-4) continue
        const p = profiles[masks.keys[r]] ?? profiles.p

        let local = p.base
        for (const layer of p.noise) {
          local += layer.amp * fbm(noise, nu * layer.freq, nv * layer.freq, 4, 2, 0.5)
        }
        for (const op of p.ops) {
          const n = fbm(noise, nu * (op.freq ?? 4), nv * (op.freq ?? 4), 3, 2, 0.5)
          switch (op.kind) {
            case 'ridge':
              local += op.weight * ridge(n)
              break
            case 'terrace':
              local += op.weight * terrace((n + 1) / 2, op.steps ?? 4)
              break
            case 'dune':
              local += op.weight * dune(nu, nv, op.angle ?? 0, op.freq ?? 10)
              break
            case 'erode':
              local = erode(local, Math.abs(n), op.k ?? 0.3)
              break
          }
        }
        h += w * local
      }

      data[iy * res + ix] = h * verticalScale
      // min/max 记录 Float32Array 实际存入后的量化值，避免与 h 的双精度值产生
      // 超出 toBeCloseTo 精度的舍入差（该量级下 float32 舍入误差 ~1e-6）。
      const stored = data[iy * res + ix]
      if (stored < min) min = stored
      if (stored > max) max = stored
    }
  }

  return { res, sizeX, sizeZ, data, min, max }
}

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
