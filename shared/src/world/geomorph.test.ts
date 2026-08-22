import { describe, expect, it } from 'vitest'
import { dune, erode, ridge, terrace } from './geomorph'

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
  it('非零 angle 时周期方向随波矢旋转', () => {
    const angle = 0.6
    const freq = 3
    const period = (Math.PI * 2) / freq
    const dx = Math.cos(angle) * period
    const dy = Math.sin(angle) * period
    expect(dune(dx, dy, angle, freq)).toBeCloseTo(dune(0, 0, angle, freq), 10)
    // 沿 x 轴平移同样距离则不应相等，否则说明 angle 没起作用
    expect(Math.abs(dune(period, 0, angle, freq) - dune(0, 0, angle, freq)))
      .toBeGreaterThan(1e-3)
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
  it('负高程原样返回，不被侵蚀也不被钳到 0', () => {
    expect(erode(-6, 0, 0.5)).toBe(-6)
    expect(erode(-6, 10, 0.5)).toBe(-6)
    expect(erode(-0.01, 3, 1)).toBe(-0.01)
  })
})
