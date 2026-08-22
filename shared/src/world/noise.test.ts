import { describe, expect, it } from 'vitest'
import { hashSeed, mulberry32 } from './rng'
import { fbm, makeValueNoise2D } from './noise'

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
