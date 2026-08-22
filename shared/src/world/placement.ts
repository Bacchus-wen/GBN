// 落点计算。论文 Eq.10–13 要从 2D 构图反解物体位姿，
// 我们的地形是自有高度场，落点与法线可以直接求得。
//
// 高度取自 sampleHeightOnMesh：ridge/terrace 刻意制造锐利折线与阶跃，
// 解析场与渲染网格在单元内部本就不相等，物体必须坐在「看得见的那个面」上。
// 法线则取自解析场的中心差分——三角面片法线是分片常量，直接用会让物体朝向
// 在跨越面片时突跳。

import { sampleHeight, sampleHeightOnMesh } from './heightfield'
import type { Heightfield } from './heightfield'

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
