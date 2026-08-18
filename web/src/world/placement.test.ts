import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { alignToNormal, normalizeToHeight } from './placement'

/** 造一个任意尺寸、原点不在底面中心的盒子 */
function boxAt(w: number, h: number, d: number, offset: THREE.Vector3) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d))
  mesh.position.copy(offset)
  const group = new THREE.Group()
  group.add(mesh)
  group.updateMatrixWorld(true)
  return group
}

describe('normalizeToHeight', () => {
  it('任意尺寸都缩放到目标高度', () => {
    for (const [w, h, d] of [[1, 1, 1], [0.02, 0.05, 0.02], [300, 900, 120]]) {
      const obj = boxAt(w, h, d, new THREE.Vector3(0, 0, 0))
      normalizeToHeight(obj, 12)
      obj.updateMatrixWorld(true)
      const size = new THREE.Vector3()
      new THREE.Box3().setFromObject(obj).getSize(size)
      expect(size.y).toBeCloseTo(12, 4)
    }
  })

  it('原点偏移的模型归一化后底面落在 y=0', () => {
    const obj = boxAt(4, 8, 4, new THREE.Vector3(17, -33, 9))
    normalizeToHeight(obj, 10)
    obj.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(obj)
    expect(box.min.y).toBeCloseTo(0, 4)
    expect(box.getCenter(new THREE.Vector3()).x).toBeCloseTo(0, 4)
    expect(box.getCenter(new THREE.Vector3()).z).toBeCloseTo(0, 4)
  })
})

describe('alignToNormal', () => {
  it('竖直法线不产生旋转', () => {
    const obj = new THREE.Object3D()
    alignToNormal(obj, { x: 3, y: 7, z: -2, nx: 0, ny: 1, nz: 0 })
    expect(obj.position.toArray()).toEqual([3, 7, -2])
    expect(obj.quaternion.angleTo(new THREE.Quaternion())).toBeCloseTo(0, 6)
  })

  it('倾斜法线把物体的 up 轴转到法线方向', () => {
    const obj = new THREE.Object3D()
    const n = new THREE.Vector3(0.5, 0.8, -0.3).normalize()
    alignToNormal(obj, { x: 0, y: 0, z: 0, nx: n.x, ny: n.y, nz: n.z })
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(obj.quaternion)
    expect(up.angleTo(n)).toBeCloseTo(0, 6)
  })
})

describe('归一化与落地对齐的组合', () => {
  it('组合后物体底面精确坐在落点上', () => {
    const cases: Array<[number, number, number, THREE.Vector3, number, number, number, number]> = [
      [4, 8, 4, new THREE.Vector3(17, -33, 9), 10, 50, 12.5, -30],
      [6, 14, 3, new THREE.Vector3(100, 500, -200), 20, -80, 3, 44],
      [300, 900, 120, new THREE.Vector3(17, -33, 9), 10, 0, 100, 0],
    ]
    for (const [w, h, d, off, target, px, py, pz] of cases) {
      const obj = boxAt(w, h, d, off)
      normalizeToHeight(obj, target)
      alignToNormal(obj, { x: px, y: py, z: pz, nx: 0, ny: 1, nz: 0 })
      obj.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(obj)
      const c = box.getCenter(new THREE.Vector3())
      expect(box.min.y).toBeCloseTo(py, 4)   // 底面坐在落点上，不悬浮也不下陷
      expect(c.x).toBeCloseTo(px, 4)
      expect(c.z).toBeCloseTo(pz, 4)
      expect(box.max.y - box.min.y).toBeCloseTo(target, 4)
    }
  })

  it('重复归一化结果稳定（幂等）', () => {
    const obj = boxAt(4, 8, 4, new THREE.Vector3(17, -33, 9))
    const heights: number[] = []
    for (let i = 0; i < 3; i++) {
      normalizeToHeight(obj, 10)
      obj.updateMatrixWorld(true)
      const b = new THREE.Box3().setFromObject(obj)
      heights.push(b.max.y - b.min.y)
    }
    for (const h of heights) expect(h).toBeCloseTo(10, 4)
  })
})
