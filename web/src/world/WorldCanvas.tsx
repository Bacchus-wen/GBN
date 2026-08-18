// 世界画布：自动取景的轨道相机 + 基础光照 + 地形。

import { OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { Landmarks } from './Landmarks'
import { TerrainMesh } from './TerrainMesh'
import type { Landmark } from '@gbn/shared'
import type { LayerKey } from '../state/types'
import type { LoadedWorld } from './loadWorld'

interface Props {
  world: LoadedWorld
  layer: LayerKey
  landmarks: Landmark[]
  onSelectLandmark?: (l: Landmark) => void
  onPick?: (
    point: THREE.Vector3,
    normal: THREE.Vector3,
    ownerGlyph: string,
    terrainKey: string,
  ) => void
}

/** 观察方向（三四分之一俯视），归一化后乘取景距离得到相机位置 */
const VIEW_DIR = new THREE.Vector3(0.55, 0.62, 0.55).normalize()

/**
 * 按画布实际宽高比精确取景。
 *
 * 不要用包围球：世界是 400×84×250 的扁盒子，它的包围球半径（约 242）远大于
 * 实际投影轮廓，按球算出来的距离会让地形缩在视口中间。这里把八个角点投到
 * 相机基底上逐个解约束——角点 p 要落在视锥内需满足
 *   |p_x| ≤ (d - p_z)·tan(hHalf)   且   |p_y| ≤ (d - p_z)·tan(vHalf)
 * 取所有角点所需 d 的最大值，就是恰好装下的距离。
 */
function FitCamera({ world }: { world: LoadedWorld }) {
  const camera = useThree(s => s.camera)
  const size = useThree(s => s.size)
  const controls = useThree(s => s.controls) as { target: THREE.Vector3; update: () => void } | null

  useEffect(() => {
    const { sizeX, sizeZ, min, max } = world.spec
    const cam = camera as THREE.PerspectiveCamera
    const target = new THREE.Vector3(0, (min + max) / 2, 0)

    // 相机基底：zAxis 由目标指向相机
    const zAxis = VIEW_DIR.clone()
    const xAxis = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), zAxis).normalize()
    const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize()

    const aspect = size.width / Math.max(1, size.height)
    const tanV = Math.tan((cam.fov * Math.PI) / 360)
    const tanH = tanV * aspect

    const hx = sizeX / 2
    const hz = sizeZ / 2
    let dist = 0
    for (const sx of [-1, 1]) {
      for (const sy of [min, max]) {
        for (const sz of [-1, 1]) {
          const p = new THREE.Vector3(sx * hx, sy, sz * hz).sub(target)
          const px = p.dot(xAxis)
          const py = p.dot(yAxis)
          const pz = p.dot(zAxis)
          dist = Math.max(dist, pz + Math.abs(px) / tanH, pz + Math.abs(py) / tanV)
        }
      }
    }
    dist *= 1.06 // 留一点边距，避免轮廓贴死画布边缘

    cam.position.copy(zAxis).multiplyScalar(dist).add(target)
    cam.near = Math.max(0.1, dist * 0.01)
    cam.far = dist * 4
    cam.updateProjectionMatrix()
    cam.lookAt(target)

    if (controls) {
      controls.target.copy(target)
      controls.update()
    }
  }, [world, camera, size.width, size.height, controls])

  return null
}

/**
 * 海平面。海洋区域的基准高程是负值，没有这个面的话整块世界读起来是一片同色的
 * 矩形板，看不出海岸线。铺得比世界略大一圈，让大陆像是浮在海里而不是嵌在盒子里。
 */
function SeaPlane({ world }: { world: LoadedWorld }) {
  const { sizeX, sizeZ } = world.spec
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[sizeX * 1.35, sizeZ * 1.35]} />
      <meshStandardMaterial
        color="#0f3b5c"
        transparent
        opacity={0.82}
        roughness={0.25}
        metalness={0.1}
      />
    </mesh>
  )
}

export function WorldCanvas({ world, layer, landmarks, onPick, onSelectLandmark }: Props) {
  const { sizeX, sizeZ, max } = world.spec
  const span = Math.max(sizeX, sizeZ)
  return (
    <Canvas shadows camera={{ fov: 45 }} className="map-canvas">
      <color attach="background" args={['#0b1a2b']} />
      <hemisphereLight args={['#cfe6ff', '#22303d', 0.75]} />
      <directionalLight
        position={[-span * 0.35, max + span * 0.5, span * 0.28]}
        intensity={1.5}
        castShadow
      />
      <SeaPlane world={world} />
      <TerrainMesh world={world} layer={layer} onPick={onPick} />
      <Landmarks world={world} landmarks={landmarks} onSelect={onSelectLandmark} />
      <OrbitControls makeDefault enableDamping />
      <FitCamera world={world} />
    </Canvas>
  )
}
