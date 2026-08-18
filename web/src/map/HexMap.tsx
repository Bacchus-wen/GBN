// 3D 世界地图。InstancedMesh 渲染全部陆地格 —— 160 格一个 draw call。
import {
  MAP_H, MAP_W, NEUTRAL_HEX, RESOURCE_COLOR, TERRAIN,
  cellColor, cellHeight, cellKey, center, mapCenter, nationById,
} from '@gbn/shared'
import type { Cell, Contested, EdgeSegment, Nation } from '@gbn/shared'
import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { hexOutlineGeometry, hexPrismGeometry } from './geometry'
import type { LayerKey, ViewMode } from '../state/types'

interface TilesProps {
  cells: Cell[]
  layer: LayerKey
  selectedNation: string | null
  draft: Set<string>
  onPick: (cell: Cell, additive: boolean) => void
}

/** 全部陆地格。颜色按图层推导，逐实例写入 instanceColor。 */
function Tiles({ cells, layer, selectedNation, draft, onPick }: TilesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const geom = useMemo(() => hexPrismGeometry(), [])
  const [hovered, setHovered] = useState<number | null>(null)
  const origin = useMemo(() => mapCenter(MAP_W, MAP_H), [])

  // 位置与高度：只在格子集合变化时重算
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    cells.forEach((cell, i) => {
      const { x, y } = center(cell.col, cell.row)
      const h = cellHeight(cell.terrain)
      m.makeScale(1, h, 1)
      m.setPosition(x - origin.x, 0, y - origin.z)
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [cells, origin])

  // 颜色：图层、选中国、草案、hover 都会影响
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const c = new THREE.Color()
    cells.forEach((cell, i) => {
      const nat = cell.owner ? nationById(cell.owner) : null
      const t = TERRAIN[cell.terrain]
      const inDraft = draft.has(cellKey(cell.col, cell.row))

      let base = nat ? nat.color : NEUTRAL_HEX
      let desat = false
      if (layer === 'terrain') base = '#7d8798'
      if (layer === 'resource') base = RESOURCE_COLOR[t.res] ?? NEUTRAL_HEX
      if (layer === 'owner' && !nat) desat = true
      // 非选中国降饱和，让选中国凸显（归属图层才有意义）
      if (layer === 'owner' && selectedNation && nat && nat.id !== selectedNation) {
        desat = true
      }

      let shift = inDraft ? 14 : 0
      if (hovered === i) shift += 12

      c.set(cellColor(base, t, { desat, shift }))
      mesh.setColorAt(i, c)
    })
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [cells, layer, selectedNation, draft, hovered])

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHovered(e.instanceId ?? null)
  }

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const id = e.instanceId
    if (id == null || !cells[id]) return
    onPick(cells[id], e.shiftKey || e.metaKey)
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[geom, undefined, cells.length]}
      castShadow
      receiveShadow
      onPointerMove={handleMove}
      onPointerOut={() => setHovered(null)}
      onClick={handleClick}
    >
      <meshLambertMaterial vertexColors />
    </instancedMesh>
  )
}

/** 国界线。用 shared 的 borderSegments 结果，抬到各格顶面之上。 */
function Borders({ segments, color, cellsMap }: {
  segments: { ax: number; ay: number; bx: number; by: number; col: number; row: number }[]
  color: string
  cellsMap: Map<string, Cell>
}) {
  const origin = useMemo(() => mapCenter(MAP_W, MAP_H), [])
  const geom = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (const s of segments) {
      const own = cellsMap.get(cellKey(s.col, s.row))
      const h = (own ? cellHeight(own.terrain) : 0) + 0.35
      pts.push(new THREE.Vector3(s.ax - origin.x, h, s.ay - origin.z))
      pts.push(new THREE.Vector3(s.bx - origin.x, h, s.by - origin.z))
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [segments, origin, cellsMap])

  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial color={color} />
    </lineSegments>
  )
}

/** 争议格 / 选中格 / 草案格的顶面轮廓环 */
function Rings({ keys, color, cellsMap }: {
  keys: string[]
  color: string
  cellsMap: Map<string, Cell>
}) {
  const geom = useMemo(() => hexOutlineGeometry(), [])
  const origin = useMemo(() => mapCenter(MAP_W, MAP_H), [])
  // 用 lineLoop 而非 line —— JSX 里 <line> 会被当成 SVG 元素
  return (
    <>
      {keys.map(k => {
        const cell = cellsMap.get(k)
        if (!cell) return null
        const { x, y } = center(cell.col, cell.row)
        return (
          <lineLoop
            key={k}
            geometry={geom}
            position={[x - origin.x, cellHeight(cell.terrain) + 0.5, y - origin.z]}
          >
            <lineBasicMaterial color={color} />
          </lineLoop>
        )
      })}
    </>
  )
}

/** 地标插旗 */
function Pins({ marks, cellsMap }: {
  marks: { col: number; row: number; pending: boolean }[]
  cellsMap: Map<string, Cell>
}) {
  const origin = useMemo(() => mapCenter(MAP_W, MAP_H), [])
  return (
    <>
      {marks.map((m, i) => {
        const cell = cellsMap.get(cellKey(m.col, m.row))
        if (!cell) return null
        const { x, y } = center(m.col, m.row)
        const base = cellHeight(cell.terrain)
        return (
          <group key={i} position={[x - origin.x, base, y - origin.z]}>
            <mesh position={[0, 3.2, 0]}>
              <boxGeometry args={[0.9, 6.4, 0.9]} />
              <meshLambertMaterial color="#0b0d12" />
            </mesh>
            <mesh position={[1.9, 5.6, 0]}>
              <boxGeometry args={[3.4, 2.4, 0.3]} />
              <meshLambertMaterial color={m.pending ? '#c46bff' : '#ffc247'} />
            </mesh>
          </group>
        )
      })}
    </>
  )
}

/** 海面。一整块平面，不再逐格画海洋格。 */
function Sea() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]} receiveShadow>
      <planeGeometry args={[MAP_W * 26, MAP_H * 30]} />
      <meshLambertMaterial color="#16243f" />
    </mesh>
  )
}

/** 相机镜头模式切换：近景俯视 ↔ 远景「地球仪」 */
function CameraRig({ mode }: { mode: ViewMode }) {
  const target = mode === 'globe' ? 420 : 210
  useFrame(({ camera }) => {
    const cam = camera as THREE.OrthographicCamera
    const want = mode === 'globe' ? 0.72 : 1.5
    cam.zoom += (want - cam.zoom) * 0.08
    cam.updateProjectionMatrix()
    // 远景抬高视角，近景压低
    const wantY = mode === 'globe' ? target : target * 0.62
    camera.position.y += (wantY - camera.position.y) * 0.08
  })
  return null
}

export interface HexMapProps {
  cells: Cell[]
  cellsMap: Map<string, Cell>
  layer: LayerKey
  view: ViewMode
  mode: 'inspect' | 'claim'
  selectedNation: string | null
  selectedCell: string | null
  draft: Set<string>
  landmarks: { col: number; row: number; status: string }[]
  showDrafts: boolean
  borderData: { nation: Nation; segments: EdgeSegment[] }[]
  /** 未裁决的争议格。裁决后不再显示红环。 */
  activeDisputes: Contested[]
  onPick: (cell: Cell, additive: boolean) => void
}

export function HexMap(props: HexMapProps) {
  const {
    cells, cellsMap, layer, view, mode, selectedNation, selectedCell,
    draft, landmarks, showDrafts, borderData, activeDisputes, onPick,
  } = props

  const pins = useMemo(
    () => landmarks
      .filter(l => l.status !== 'pending' || showDrafts)
      .map(l => ({ col: l.col, row: l.row, pending: l.status === 'pending' })),
    [landmarks, showDrafts],
  )

  const contestedKeys = useMemo(
    () => activeDisputes.map(c => cellKey(c.col, c.row)),
    [activeDisputes],
  )

  return (
    <Canvas
      className={`map-canvas${mode === 'claim' ? ' picking' : ''}`}
      orthographic
      camera={{ position: [150, 130, 190], zoom: 1.5, near: 0.1, far: 3000 }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#101a2e']} />
      <ambientLight intensity={0.62} />
      <directionalLight position={[120, 220, 80]} intensity={1.15} />
      <directionalLight position={[-140, 90, -60]} intensity={0.32} color="#8fb4ff" />

      <Sea />
      <Tiles
        cells={cells}
        layer={layer}
        selectedNation={layer === 'owner' ? selectedNation : null}
        draft={draft}
        onPick={onPick}
      />

      {borderData.map(({ nation, segments }) => (
        <Borders
          key={nation.id}
          segments={segments}
          color={nation.id === selectedNation ? '#ffc247' : '#0b0d12'}
          cellsMap={cellsMap}
        />
      ))}

      <Rings keys={contestedKeys} color="#ff5a3c" cellsMap={cellsMap} />
      <Rings keys={[...draft]} color="#c46bff" cellsMap={cellsMap} />
      {selectedCell && (
        <Rings keys={[selectedCell]} color="#ffc247" cellsMap={cellsMap} />
      )}

      <Pins marks={pins} cellsMap={cellsMap} />

      <CameraRig mode={view} />
      <OrbitControls
        enablePan={view !== 'globe'}
        minPolarAngle={0.18}
        maxPolarAngle={Math.PI / 2.35}
        minZoom={0.4}
        maxZoom={4}
        makeDefault
      />
    </Canvas>
  )
}
