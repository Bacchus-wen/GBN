// 地形顶点着色。三个图层各有一套配色，都从烘焙出的索引图取值：
// 归属层读 owners.bin（国家色），地形层与资源层读 regions.bin。
//
// 索引图是最近邻采样的硬索引，所以边界是清晰的——领土边界本来就该看得出来，
// 不该是一片渐变。高度和坡度只用来做明暗调制，不改变色相，避免把归属看混。

import { RESOURCE_COLOR, TERRAIN, nationByGlyph } from '@gbn/shared'
import { sampleIndex } from '@gbn/shared/world'
import * as THREE from 'three'
import type { LayerKey } from '../state/types'
import type { LoadedWorld } from './loadWorld'

/** 海洋与无主地的颜色，三个图层通用 */
const OCEAN = '#123046'
const UNCLAIMED = '#6b7684'

const TERRAIN_COLOR: Record<string, string> = {
  p: '#7fa661', // 平原
  f: '#3f7a44', // 森林
  m: '#8a8f99', // 山地
  c: '#c8b78a', // 海岸
  i: '#d5e6f0', // 冰原
  r: '#6e7f8c', // 礁岩
  v: '#a05236', // 火山
  d: '#d8c07a', // 荒漠
  '*': UNCLAIMED,
  '.': OCEAN,
}

function colorFor(layer: LayerKey, terrainKey: string, ownerGlyph: string): string {
  if (terrainKey === '.') return OCEAN
  switch (layer) {
    case 'owner': {
      if (ownerGlyph === '.' ) return OCEAN
      const n = nationByGlyph(ownerGlyph)
      return n ? n.color : UNCLAIMED
    }
    case 'terrain':
      return TERRAIN_COLOR[terrainKey] ?? UNCLAIMED
    case 'resource': {
      const t = TERRAIN[terrainKey as keyof typeof TERRAIN]
      return t ? RESOURCE_COLOR[t.res] : UNCLAIMED
    }
  }
}

/**
 * 为地形网格的每个顶点算一个颜色。
 * @param positions 网格顶点位置属性（已位移到最终高度）
 */
export function buildVertexColors(
  world: LoadedWorld,
  layer: LayerKey,
  positions: THREE.BufferAttribute,
): Float32Array {
  const { spec, regions, owners } = world
  const regionView = { data: regions, res: spec.res, sizeX: spec.sizeX, sizeZ: spec.sizeZ }
  const ownerView = { data: owners, res: spec.res, sizeX: spec.sizeX, sizeZ: spec.sizeZ }

  const out = new Float32Array(positions.count * 3)
  const c = new THREE.Color()
  const span = Math.max(1e-6, spec.max - spec.min)
  const cache = new Map<string, [number, number, number]>()

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const y = positions.getY(i)
    const z = positions.getZ(i)

    const terrainKey = spec.regions[sampleIndex(regionView, x, z)] ?? 'p'
    const ownerGlyph = spec.owners[sampleIndex(ownerView, x, z)] ?? '*'
    const key = `${layer}|${terrainKey}|${ownerGlyph}`

    let rgb = cache.get(key)
    if (!rgb) {
      c.set(colorFor(layer, terrainKey, ownerGlyph))
      rgb = [c.r, c.g, c.b]
      cache.set(key, rgb)
    }

    // 高度做轻微明暗调制，保留立体感但不改变色相
    const t = (y - spec.min) / span
    const shade = 0.78 + t * 0.34

    out[i * 3] = rgb[0] * shade
    out[i * 3 + 1] = rgb[1] * shade
    out[i * 3 + 2] = rgb[2] * shade
  }
  return out
}
