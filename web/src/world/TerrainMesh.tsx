// 地形网格：PlaneGeometry 按高度场位移，顶点色由当前图层决定。
// 网格分辨率低于高度场分辨率，位移用 sampleHeight 取值，与 shared 的解析采样保持一致。

import { sampleHeight, sampleIndex } from '@gbn/shared/world'
import { useMemo } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { buildVertexColors } from './palette'
import type { LayerKey } from '../state/types'
import type { LoadedWorld } from './loadWorld'

interface Props {
  world: LoadedWorld
  layer: LayerKey
  /**
   * 点击地形。ownerGlyph 是归属层字符（'.' 海洋、'*' 无主），
   * terrainKey 是地貌层字符（见 TERRAIN）。
   */
  onPick?: (
    point: THREE.Vector3,
    normal: THREE.Vector3,
    ownerGlyph: string,
    terrainKey: string,
  ) => void
  /** 指针在地形上移动。拖拽地标时用它实时取落点。 */
  onHover?: (point: THREE.Vector3) => void
}

export function TerrainMesh({ world, layer, onPick, onHover }: Props) {
  // 几何只依赖世界数据，切图层时不必重建
  const geometry = useMemo(() => {
    const { sizeX, sizeZ, meshRes } = world.spec
    const geo = new THREE.PlaneGeometry(sizeX, sizeZ, meshRes - 1, meshRes - 1)
    geo.rotateX(-Math.PI / 2)   // 平面转到 xz 面，y 作高度
    const pos = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, sampleHeight(world.hf, pos.getX(i), pos.getZ(i)))
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
    return geo
  }, [world])

  // 顶点色随图层变化
  useMemo(() => {
    const colors = buildVertexColors(world, layer, geometry.attributes.position as THREE.BufferAttribute)
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return colors
  }, [world, layer, geometry])

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!onPick) return
    e.stopPropagation()
    const normal = e.face
      ? e.face.normal.clone().transformDirection(e.object.matrixWorld)
      : new THREE.Vector3(0, 1, 0)
    const { spec, owners, regions } = world
    const view = { res: spec.res, sizeX: spec.sizeX, sizeZ: spec.sizeZ }
    const glyph = spec.owners[sampleIndex({ ...view, data: owners }, e.point.x, e.point.z)] ?? '*'
    const terrainKey = spec.regions[sampleIndex({ ...view, data: regions }, e.point.x, e.point.z)] ?? 'p'
    onPick(e.point.clone(), normal, glyph, terrainKey)
  }

  return (
    <mesh
      geometry={geometry}
      onClick={handleClick}
      onPointerMove={onHover ? e => { e.stopPropagation(); onHover(e.point) } : undefined}
      receiveShadow
      castShadow
    >
      <meshStandardMaterial vertexColors roughness={0.92} metalness={0.02} />
    </mesh>
  )
}
