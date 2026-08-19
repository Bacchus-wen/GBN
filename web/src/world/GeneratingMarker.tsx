// 生成中占位体。Tripo 一次要 1-3 分钟，这段时间落点上先立一个会呼吸的半透明体，
// 让世界的构图从第一秒就是完整的，而不是让用户对着一块空地干等。

import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type { Placement } from '@gbn/shared'

const H = 16

export function GeneratingMarker({ placement }: { placement: Placement }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const ring = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (mat.current) mat.current.opacity = 0.25 + Math.sin(t * 2.2) * 0.12
    // 基座环缓慢转动，明确传达「进行中」而不是「坏了」
    if (ring.current) ring.current.rotation.z = t * 0.6
  })

  return (
    <group position={[placement.x, placement.y, placement.z]}>
      <mesh position={[0, H / 2, 0]}>
        <boxGeometry args={[9, H, 9]} />
        <meshStandardMaterial
          ref={mat}
          color="#2bd9f0"
          emissive="#2bd9f0"
          emissiveIntensity={0.5}
          transparent
          opacity={0.3}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={ring} position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[6, 8.4, 4]} />
        <meshBasicMaterial color="#2bd9f0" transparent opacity={0.75} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
