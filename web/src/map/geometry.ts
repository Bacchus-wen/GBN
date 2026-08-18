// 六棱柱几何。单位高度 1，实例化时用 scale.y 拉伸到地形高度。
import { HEX_R, GAP } from '@gbn/shared'
import * as THREE from 'three'

/**
 * flat-top 六棱柱。CylinderGeometry 的 6 边柱天然就是六棱柱，
 * 旋转 30° 后与 hexPoints 的顶点朝向一致（顶点从右开始）。
 *
 * 底面下沉到 y=0，顶面在 y=1 —— 这样 scale.y 直接等于地形高度，
 * 且所有格子共底，海平面切割一致。
 */
export function hexPrismGeometry(): THREE.BufferGeometry {
  const r = HEX_R - GAP
  const g = new THREE.CylinderGeometry(r, r, 1, 6, 1, false)
  // CylinderGeometry 的 6 边形第一个顶点在 +Z 方向；转 30° 让它对齐 flat-top
  g.rotateY(Math.PI / 6)
  // 中心从 y=0 移到 y=0.5，于是底面贴 y=0、顶面在 y=1
  g.translate(0, 0.5, 0)
  // drei 的 three-mesh-bvh 类型增强只落在 BufferGeometry 上，这里显式收窄
  return g as THREE.BufferGeometry
}

/**
 * 顶面高亮用的六边形轮廓，配 <lineLoop> 用（6 点自动闭合）。
 * 半径略大避免与柱体 z-fighting。
 */
export function hexOutlineGeometry(scale = 1.04): THREE.BufferGeometry {
  const r = (HEX_R - GAP) * scale
  const pts: THREE.Vector3[] = []
  for (let i = 0; i < 6; i++) {
    // 与 hexPoints 同相位：60°·i，flat-top
    const a = (Math.PI / 180) * (60 * i)
    pts.push(new THREE.Vector3(r * Math.cos(a), 0, r * Math.sin(a)))
  }
  return new THREE.BufferGeometry().setFromPoints(pts)
}

/** 由平面线段生成 LineSegments 几何（国界用） */
export function segmentsGeometry(
  pts: THREE.Vector3[],
): THREE.BufferGeometry {
  return new THREE.BufferGeometry().setFromPoints(pts)
}
