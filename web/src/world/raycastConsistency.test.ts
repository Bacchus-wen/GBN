// 落点与渲染面一致性的对比测试（非自证）。
//
// shared/src/world/placement.test.ts 里的断言是 placementAt(...).y === sampleHeightOnMesh(...)，
// 但 placementAt 内部第一步就是调 sampleHeightOnMesh —— 那是函数跟自己比，恒真，任何三角剖分
// 实现变化都不会被测出来。这里改用与 TerrainMesh.tsx 完全相同的方式构建一份真实 three.js
// 几何体，用真实的 THREE.Raycaster 从正上方打下去，把交点 y 和 placementAt 的解析结果对比。
// 只有两者独立算出的高度一致，才说明落点真的坐在渲染出来的那个面上。
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  TERRAIN_PROFILES, buildHeightfield, buildMasks, placementAt, sampleHeight,
} from '@gbn/shared/world'
import type { Heightfield } from '@gbn/shared/world'

// 小规模高度场，控制测试耗时；'m'（ridge）与 'i'（terrace）确保锐利地貌被覆盖到。
const RES = 64
const MESH_RES = 64
const SIZE = 120 // 正方形世界，方便用同一个 cellSize 判定容差
const SOFTNESS = 3
const SEED = 20260818

const ASCII_MAP = [
  'mmiipp..',
  'mmiipp..',
  '..mmiipp',
  '..mmiipp',
  'pp..mmii',
  'pp..mmii',
  'iipp..mm',
  'iipp..mm',
]

const hf: Heightfield = buildHeightfield(
  buildMasks(ASCII_MAP, RES, SOFTNESS),
  TERRAIN_PROFILES, SEED, SIZE, SIZE,
)

/** 与 web/src/world/TerrainMesh.tsx 完全相同的方式构建渲染网格 */
function buildRenderMesh(hf: Heightfield, meshRes: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(hf.sizeX, hf.sizeZ, meshRes - 1, meshRes - 1)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, sampleHeight(hf, pos.getX(i), pos.getZ(i)))
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(geo)
  mesh.updateMatrixWorld(true)
  return mesh
}

/** 从正上方垂直向下打一条真实射线，返回与 mesh 的交点 y（打不中则返回 null） */
function raycastDown(mesh: THREE.Mesh, x: number, z: number, fromY: number): number | null {
  const raycaster = new THREE.Raycaster()
  raycaster.set(new THREE.Vector3(x, fromY, z), new THREE.Vector3(0, -1, 0))
  const hits = raycaster.intersectObject(mesh, false)
  return hits.length > 0 ? hits[0].point.y : null
}

describe('placementAt 与真实渲染网格的一致性（raycast 对比，非自证）', () => {
  const mesh = buildRenderMesh(hf, MESH_RES)
  const cellSize = hf.sizeX / (MESH_RES - 1)
  const tolerance = cellSize * 0.01 // 判据：误差 < 网格单元尺寸的 1%
  const fromY = hf.max + 50
  const half = hf.sizeX / 2
  const margin = cellSize * 0.5 // 避开边界夹取，避免越界钳制干扰对比

  it(`真实 raycaster 交点与 placementAt 的差 < 网格单元的 1%（容差 ${tolerance.toFixed(5)}）`, () => {
    const N = 300
    let checked = 0
    for (let i = 0; i < N; i++) {
      // 黄金比散布，刻意避开网格线对齐，覆盖每个 quad 内部（含对角线两侧）
      const fx = (i * 0.6180339887498949) % 1
      const fz = (i * 0.4142135623730951) % 1
      const x = -half + margin + fx * (hf.sizeX - 2 * margin)
      const z = -half + margin + fz * (hf.sizeZ - 2 * margin)

      const real = raycastDown(mesh, x, z, fromY)
      expect(real).not.toBeNull()
      if (real === null) continue

      const analytic = placementAt(hf, x, z, MESH_RES).y
      expect(Math.abs(analytic - real)).toBeLessThan(tolerance)
      checked++
    }
    // 保证真的采样到了足够的点，不是因为 raycast 全部落空才“通过”
    expect(checked).toBeGreaterThan(250)
  })
})
