import { describe, expect, it } from 'vitest'
import { sampleIndex } from './indexmap'
import type { IndexMapView } from './indexmap'

/** 4×4 索引图，左上 0、右上 1、左下 2、右下 3 */
const map: IndexMapView = {
  res: 4,
  sizeX: 400,
  sizeZ: 250,
  data: new Uint8Array([
    0, 0, 1, 1,
    0, 0, 1, 1,
    2, 2, 3, 3,
    2, 2, 3, 3,
  ]),
}

describe('sampleIndex', () => {
  it('四角映射到四角的索引', () => {
    expect(sampleIndex(map, -200, -125)).toBe(0)
    expect(sampleIndex(map, 200, -125)).toBe(1)
    expect(sampleIndex(map, -200, 125)).toBe(2)
    expect(sampleIndex(map, 200, 125)).toBe(3)
  })

  it('象限内部返回该象限的索引', () => {
    expect(sampleIndex(map, -150, -90)).toBe(0)
    expect(sampleIndex(map, 150, -90)).toBe(1)
    expect(sampleIndex(map, -150, 90)).toBe(2)
    expect(sampleIndex(map, 150, 90)).toBe(3)
  })

  it('x 与 z 不混用（矩形世界下按各自的 size 归一化）', () => {
    // 若把 sizeZ 当成 sizeX 用，(150, -90) 会落到别的象限
    expect(sampleIndex(map, 150, -90)).toBe(1)
    expect(sampleIndex(map, -90, 90)).toBe(2)
  })

  it('越界坐标夹取到边缘，不返回 undefined', () => {
    expect(sampleIndex(map, -99999, -99999)).toBe(0)
    expect(sampleIndex(map, 99999, 99999)).toBe(3)
    expect(Number.isInteger(sampleIndex(map, 99999, -99999))).toBe(true)
  })

  it('返回的永远是最近邻的原始索引，不做插值', () => {
    // 边界两侧只会出现 0 或 1，不会出现 0.5 这种插值产物
    for (let i = 0; i <= 40; i++) {
      const v = sampleIndex(map, -200 + i * 10, -125)
      expect(v === 0 || v === 1).toBe(true)
    }
  })
})
