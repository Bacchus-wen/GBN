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
