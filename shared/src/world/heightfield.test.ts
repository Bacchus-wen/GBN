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
