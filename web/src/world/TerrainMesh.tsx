// 地形网格：PlaneGeometry 按高度场位移。网格分辨率低于高度场分辨率，
// 位移用 sampleHeight 取值，与 shared 的解析采样保持一致。

import { sampleHeight } from '@gbn/shared/world'
import { useMemo } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { LoadedWorld } from './loadWorld'

interface Props {
  world: LoadedWorld
  onPick?: (point: THREE.Vector3, normal: THREE.Vector3) => void
}

export function TerrainMesh({ world, onPick }: Props) {
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

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!onPick) return
    e.stopPropagation()
    const normal = e.face
      ? e.face.normal.clone().transformDirection(e.object.matrixWorld)
      : new THREE.Vector3(0, 1, 0)
    onPick(e.point.clone(), normal)
  }

  return (
    <mesh geometry={geometry} onClick={handleClick} receiveShadow castShadow>
      <meshStandardMaterial color="#5d7a8c" />
    </mesh>
  )
}
