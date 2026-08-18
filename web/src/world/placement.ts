// GLB 归一化与落地对齐。生成模型的尺寸与原点约定各不相同，
// 不归一化会出现巨大化或穿模，这是接入任何 3D 生成 API 的必备前处理。

import * as THREE from 'three'
import type { Placement } from '@gbn/shared/world'

/**
 * 归一化：把物体的局部原点移到底面中心，并缩放到目标高度。
 * 归一化后 object.position 不承载任何校正量，可被 alignToNormal 安全覆盖。
 * 幂等：重复调用结果一致。
 */
export function normalizeToHeight(object: THREE.Object3D, targetHeight: number): void {
  // 先复位自身变换，保证测量在未缩放状态下进行（这是幂等的关键）
  object.scale.set(1, 1, 1)
  object.position.set(0, 0, 0)
  object.updateMatrixWorld(true)

  const box = new THREE.Box3().setFromObject(object)
  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  box.getSize(size)
  box.getCenter(center)

  // 此时 scale 为 1，局部与世界同单位，可以直接平移子节点
  const shift = new THREE.Vector3(-center.x, -box.min.y, -center.z)
  for (const child of object.children) child.position.add(shift)

  object.scale.setScalar(targetHeight / Math.max(size.y, 1e-4))
  object.updateMatrixWorld(true)
}

/** 把物体摆到落点并贴合地表法线 */
export function alignToNormal(object: THREE.Object3D, p: Placement): void {
  object.position.set(p.x, p.y, p.z)
  const up = new THREE.Vector3(0, 1, 0)
  const n = new THREE.Vector3(p.nx, p.ny, p.nz).normalize()
  object.quaternion.setFromUnitVectors(up, n)
}
