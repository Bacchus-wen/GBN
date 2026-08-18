// 世界画布：轨道相机 + 基础光照 + 地形。

import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import type * as THREE from 'three'
import { TerrainMesh } from './TerrainMesh'
import type { LoadedWorld } from './loadWorld'

interface Props {
  world: LoadedWorld
  onPick?: (point: THREE.Vector3, normal: THREE.Vector3) => void
}

export function WorldCanvas({ world, onPick }: Props) {
  const { sizeX, sizeZ } = world.spec
  const span = Math.max(sizeX, sizeZ)
  return (
    <Canvas
      shadows
      camera={{ position: [span * 0.6, span * 0.5, span * 0.6], fov: 45, far: span * 5 }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#0b1a2b']} />
      <hemisphereLight args={['#cfe6ff', '#22303d', 0.7]} />
      <directionalLight position={[span * 0.4, span * 0.8, span * 0.3]} intensity={1.4} castShadow />
      <TerrainMesh world={world} onPick={onPick} />
      <OrbitControls makeDefault enableDamping target={[0, 0, 0]} />
    </Canvas>
  )
}
