// GLB 归一化与落地对齐。生成模型的尺寸与原点约定各不相同，
// 不归一化会出现巨大化或穿模，这是接入任何 3D 生成 API 的必备前处理。

import * as THREE from 'three'
import type { Placement } from '@gbn/shared/world'

/** 量包围盒 → 缩放到目标高度 → 原点移到底面中心 */
export function normalizeToHeight(object: THREE.Object3D, targetHeight: number): void {
  const box = new THREE.Box3().setFromObject(object)
  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  box.getSize(size)
  box.getCenter(center)

  // 计算缩放因子
  const scale = targetHeight / Math.max(size.y, 1e-4)

  // 调整所有子对象位置，使其相对于包围盒中心而非 Group 位置
  const offset = center.clone().sub(object.position)
  object.children.forEach((child) => {
    const relPos = child.position.clone().sub(offset)
    child.position.copy(relPos)
  })

  // 现在 Group 的包围盒中心就在 Group 的原点
  // 修改 Group 的位置和缩放
  object.position.set(0, 0, 0)
  object.scale.setScalar(scale)

  // 更新矩阵以获得缩放后的包围盒
  object.updateMatrixWorld(true)

  // 调整 y 坐标使底面落在 0
  const newBox = new THREE.Box3().setFromObject(object)
  object.position.y = -newBox.min.y
}

/** 把物体摆到落点并贴合地表法线 */
export function alignToNormal(object: THREE.Object3D, p: Placement): void {
  object.position.set(p.x, p.y, p.z)
  const up = new THREE.Vector3(0, 1, 0)
  const n = new THREE.Vector3(p.nx, p.ny, p.nz).normalize()
  object.quaternion.setFromUnitVectors(up, n)
}
