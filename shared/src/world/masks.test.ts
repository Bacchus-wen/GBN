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

  it('两轴 σ 不同时过渡带宽度按轴分别变化', () => {
    // 世界是矩形而掩膜是正方形采样，调用方需要按轴传不同 σ 才能得到
    // 世界空间各向同性的过渡带。这里验证两个方向确实独立生效。
    const band = (m: ReturnType<typeof buildMasks>, axis: 'x' | 'y') => {
      const ai = m.keys.indexOf('a')
      let count = 0
      for (let i = 0; i < m.res; i++) {
        const w = axis === 'x' ? maskAt(m, ai, i, 10) : maskAt(m, ai, 10, i)
        if (w > 0.05 && w < 0.95) count++
      }
      return count
    }
    const wide = buildMasks(ROWS, 128, 10, 2)
    expect(band(wide, 'x')).toBeGreaterThan(band(wide, 'y'))
    const tall = buildMasks(ROWS, 128, 2, 10)
    expect(band(tall, 'y')).toBeGreaterThan(band(tall, 'x'))
  })

  it('dominantRegion 在区域内部返回该区', () => {
    const m = buildMasks(ROWS, 64, 2)
    expect(m.keys[dominantRegion(m, 4, 4)]).toBe('a')
    expect(m.keys[dominantRegion(m, 60, 60)]).toBe('d')
  })
})
