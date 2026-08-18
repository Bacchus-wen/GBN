// GLB 归一化与落地对齐。生成模型的尺寸与原点约定各不相同，
// 不归一化会出现巨大化或穿模，这是接入任何 3D 生成 API 的必备前处理。

import * as THREE from 'three'
import type { Placement } from '@gbn/shared/world'

/**
 * 归一化：把物体的局部原点移到底面中心，并缩放到目标高度。
 * 归一化后 object.position 不承载任何校正量，可被 alignToNormal 安全覆盖。
 * 幂等：重复调用结果一致。
 *
 * **调用顺序契约（调用方必须遵守）：** 必须先调用 normalizeToHeight，再调用
 * alignToNormal —— 顺序反了不会报错，但会静默产出错误结果。原因：本函数一进入
 * 就无条件复位 object.scale 和 object.position 后再测量包围盒；如果 alignToNormal
 * 已经把物体摆到了落点（设置过 position），这里会把那个落点直接冲掉，且后续的
 * 缩放测量也会用错误的（未对齐前的）局部坐标系。调用前不要依赖 object 已设置的
 * position / scale——它们在函数入口处就会被复位，不会被保留或叠加。
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

  // 裸 Mesh（自身持有 geometry、没有子节点承载居中量）必须把 shift 直接烘进顶点数据，
  // 否则上面的子节点循环一次都不会执行，居中量无处安放，会静默丢失
  // （高度缩放依然正确，但物体会陷地/偏心）。GLTFLoader 返回的 gltf.scene 通常是
  // Group，不会触发这条路径；但 gltf.scene.children[0] 或单网格原型会。
  if (object instanceof THREE.Mesh) {
    object.geometry.translate(shift.x, shift.y, shift.z)
  }

  object.scale.setScalar(targetHeight / Math.max(size.y, 1e-4))
  object.updateMatrixWorld(true)
}

/**
 * 把物体摆到落点并贴合地表法线。
 *
 * **前置条件：** 依赖 object 已经调用过 normalizeToHeight —— 本函数只设置
 * position/quaternion，不做任何缩放或居中；若在归一化之前调用本函数，
 * normalizeToHeight 随后会把这里设置的 position 复位掉。
 */
export function alignToNormal(object: THREE.Object3D, p: Placement): void {
  object.position.set(p.x, p.y, p.z)
  const up = new THREE.Vector3(0, 1, 0)
  const n = new THREE.Vector3(p.nx, p.ny, p.nz).normalize()
  object.quaternion.setFromUnitVectors(up, n)
}
