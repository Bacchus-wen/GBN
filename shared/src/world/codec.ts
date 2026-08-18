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
