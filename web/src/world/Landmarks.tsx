// 地标渲染。种子地标的坐标是从旧的六角格编号换算来的，y 与法线都是占位值
// （authoring 阶段拿不到烘焙产物），所以这里一律用 placementAt 重新贴合真实地形。
//
// 没有模型的地标用程序化几何占位——这正是论文里 scatter 资产的做法：
// 重复实例化的低价值几何不该花钱生成。有 modelUrl 的走 GLB 加载（层 3 后续）。

import { placementAt } from '@gbn/shared/world'
import { nationById } from '@gbn/shared'
import { useGLTF } from '@react-three/drei'
import { Suspense, useMemo } from 'react'
import * as THREE from 'three'
import { alignToNormal, normalizeToHeight } from './placement'
import type { Landmark, Placement } from '@gbn/shared'
import type { LoadedWorld } from './loadWorld'

interface Props {
  world: LoadedWorld
  landmarks: Landmark[]
  /** 点击地标 */
  onSelect?: (l: Landmark) => void
}

/**
 * 地标塔身高度（世界单位）。相机默认装下整个 400×250 的世界，
 * 太细的柱子在这个视距下会糊成一根黑线——实测 11 基本看不见，18 才立得住。
 */
const PYLON_H = 18

/** 生成模型在世界里的目标高度。与程序化塔身同量级，避免大小失控 */
const MODEL_H = 16

/**
 * GLB 地标。生成模型的尺寸与原点约定各不相同，必须先归一化再落位。
 *
 * useGLTF 会缓存并复用同一个 scene 实例，而 normalizeToHeight 会永久改写
 * 子节点的 position——不 clone 就会把缓存里的模板改坏，第二个实例开始全错。
 */
function GlbMarker({ url, p }: { url: string; p: Placement }) {
  const gltf = useGLTF(url)

  const object = useMemo(() => {
    const obj = gltf.scene.clone(true)
    obj.traverse(o => {
      const m = o as THREE.Mesh
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true }
    })
    normalizeToHeight(obj, MODEL_H)
    alignToNormal(obj, p)
    return obj
  }, [gltf, p])

  return <primitive object={object} />
}

function Marker({ world, l, onSelect }: { world: LoadedWorld; l: Landmark; onSelect?: (l: Landmark) => void }) {
  const nation = nationById(l.nationId)
  const color = nation?.color ?? '#9aa4b2'
  const pending = l.status !== 'approved'

  // 重新贴合地形：种子数据里的 y 是 0，不能直接用
  const p = useMemo(
    () => placementAt(world.hf, l.placement.x, l.placement.z, world.spec.meshRes),
    [world, l.placement.x, l.placement.z],
  )

  // 有生成模型就用模型，没有就用程序化占位。
  // 模型加载中由 Suspense 兜底为占位塔身，不让世界出现空洞。
  if (l.modelUrl) {
    return (
      <group onClick={e => { e.stopPropagation(); onSelect?.(l) }}>
        <Suspense fallback={<Pylon p={p} color={color} pending />}>
          <GlbMarker url={l.modelUrl} p={p} />
        </Suspense>
        <mesh position={[p.x, p.y + 0.4, p.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[4.4, 6.2, 18]} />
          <meshBasicMaterial color={color} transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      </group>
    )
  }

  return <Pylon p={p} color={color} pending={pending} onClick={() => onSelect?.(l)} />
}

/** 程序化占位地标 */
function Pylon({
  p, color, pending, onClick,
}: { p: Placement; color: string; pending: boolean; onClick?: () => void }) {
  return (
    <group
      position={[p.x, p.y, p.z]}
      onClick={e => { e.stopPropagation(); onClick?.() }}
    >
      {/* 塔身用骨白色而不是国家色：归属层的地面本身就是国家色，
          同色塔身等于隐形。国家身份交给顶部宝石和基座环去表达。 */}
      <mesh position={[0, PYLON_H / 2, 0]} castShadow>
        <cylinderGeometry args={[1.5, 3.4, PYLON_H, 6]} />
        <meshStandardMaterial
          color={pending ? '#8b93a0' : '#e9e3d5'}
          roughness={0.55}
          metalness={0.12}
          transparent={pending}
          opacity={pending ? 0.5 : 1}
        />
      </mesh>

      {/* 顶部标记球，待核准的用暗色以示区分 */}
      <mesh position={[0, PYLON_H + 2.6, 0]} castShadow>
        <octahedronGeometry args={[3.4, 0]} />
        <meshStandardMaterial
          color={pending ? '#6b7684' : color}
          emissive={pending ? '#000000' : color}
          emissiveIntensity={pending ? 0 : 0.9}
          transparent={pending}
          opacity={pending ? 0.5 : 1}
        />
      </mesh>

      {/* 基座环，让地标在起伏地形上也有明确的落地感 */}
      <mesh position={[0, 0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.4, 6.2, 18]} />
        <meshBasicMaterial color={color} transparent opacity={pending ? 0.3 : 0.7} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

export function Landmarks({ world, landmarks, onSelect }: Props) {
  return (
    <>
      {landmarks.map((l, i) => (
        <Marker key={`${l.nationId}-${l.name}-${i}`} world={world} l={l} onSelect={onSelect} />
      ))}
    </>
  )
}
