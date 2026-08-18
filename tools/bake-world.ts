// 离线烘焙：ASCII 图 → 区域掩膜 → Eq.6 高度场 → web/public/world/ 静态资产。
// 运行：npm run bake:world

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OWNER_MAP, TERRAIN_MAP } from '../shared/src/data.js'
import {
  TERRAIN_PROFILES, buildHeightfield, buildMasks, encodeHeights, encodeRegions,
} from '../shared/src/world/index.js'
import type { WorldSpec } from '../shared/src/world/index.js'

const RES = 512
const MESH_RES = 256
const SIZE_X = 400
const SIZE_Z = 250
const SOFTNESS = 6
const SEED = 20260818

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'web/public/world')

const terrainMasks = buildMasks(TERRAIN_MAP, RES, SOFTNESS)
const ownerMasks = buildMasks(OWNER_MAP, RES, SOFTNESS)
const hf = buildHeightfield(terrainMasks, TERRAIN_PROFILES, SEED, SIZE_X, SIZE_Z)

const spec: WorldSpec = {
  res: RES,
  meshRes: MESH_RES,
  sizeX: SIZE_X,
  sizeZ: SIZE_Z,
  seed: SEED,
  min: hf.min,
  max: hf.max,
  regions: terrainMasks.keys,
  owners: ownerMasks.keys,
}

mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, 'heightmap.bin'), Buffer.from(encodeHeights(hf).buffer))
writeFileSync(resolve(outDir, 'regions.bin'), Buffer.from(encodeRegions(terrainMasks).buffer))
writeFileSync(resolve(outDir, 'owners.bin'), Buffer.from(encodeRegions(ownerMasks).buffer))
writeFileSync(resolve(outDir, 'world-spec.json'), JSON.stringify(spec, null, 2))

console.log(`烘焙完成 -> ${outDir}`)
console.log(`  采样 ${RES}  世界 ${SIZE_X}x${SIZE_Z}  高度 ${hf.min.toFixed(2)} ~ ${hf.max.toFixed(2)}`)
console.log(`  地形区 ${terrainMasks.keys.join('')}  归属区 ${ownerMasks.keys.join('')}`)
