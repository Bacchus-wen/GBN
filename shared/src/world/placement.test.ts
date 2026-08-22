import { describe, expect, it } from 'vitest'
import { buildMasks } from './masks'
import { TERRAIN_PROFILES, buildHeightfield, sampleHeightOnMesh } from './heightfield'
import { placementAt } from './placement'

const MESH_RES = 256

const hf = buildHeightfield(
  buildMasks(['ppmm', 'ppmm', 'ccii', 'ccii'], 64, 3),
  TERRAIN_PROFILES, 2026, 400, 250,
)

describe('placementAt', () => {
  it('落点高度与渲染网格插值逐位一致', () => {
    // 本模块存在的意义：物体必须精确坐在看得见的地面上，不悬浮也不陷入
    for (const [x, z] of [[12, -34], [0, 0], [77.5, 41.25], [-150, 100]]) {
      expect(placementAt(hf, x, z, MESH_RES).y)
        .toBe(sampleHeightOnMesh(hf, x, z, MESH_RES))
    }
  })

  it('法线是单位向量', () => {
    const p = placementAt(hf, 40, 40, MESH_RES)
    expect(Math.hypot(p.nx, p.ny, p.nz)).toBeCloseTo(1, 6)
  })

  it('法线朝上', () => {
    for (const [x, z] of [[0, 0], [50, -80], [-120, 90]]) {
      expect(placementAt(hf, x, z, MESH_RES).ny).toBeGreaterThan(0)
    }
  })

  it('陡坡处法线明显偏离竖直，平坦处接近竖直', () => {
    let steepest = 1
    let flattest = 0
    for (let i = 0; i < 400; i++) {
      const x = -hf.sizeX / 2 + ((i * 7.3) % hf.sizeX)
      const z = -hf.sizeZ / 2 + ((i * 11.7) % hf.sizeZ)
      const ny = placementAt(hf, x, z, MESH_RES).ny
      steepest = Math.min(steepest, ny)
      flattest = Math.max(flattest, ny)
    }
    expect(steepest).toBeLessThan(0.99)
    expect(flattest).toBeGreaterThan(0.999)
  })

  it('越界坐标不产生 NaN', () => {
    const p = placementAt(hf, 99999, -99999, MESH_RES)
    expect(Number.isFinite(p.y)).toBe(true)
    expect(Number.isFinite(p.nx)).toBe(true)
    expect(Number.isFinite(p.nz)).toBe(true)
  })
})
