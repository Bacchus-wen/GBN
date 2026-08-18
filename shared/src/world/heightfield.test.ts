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

  it('放置正确性：解析采样与网格三角插值之差小于格宽的 1%', () => {
    const hf = build(31)
    const meshRes = 256
    const cellX = hf.sizeX / (meshRes - 1)
    const cellZ = hf.sizeZ / (meshRes - 1)
    const tol = Math.max(cellX, cellZ) * 0.01
    for (let i = 0; i < 50; i++) {
      const x = -hf.sizeX / 2 + ((i * 7.3) % hf.sizeX)
      const z = -hf.sizeZ / 2 + ((i * 11.7) % hf.sizeZ)
      expect(Math.abs(sampleHeight(hf, x, z) - sampleHeightOnMesh(hf, x, z, meshRes)))
        .toBeLessThan(tol)
    }
  })
})
