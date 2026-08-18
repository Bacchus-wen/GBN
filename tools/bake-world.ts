// 离线烘焙：ASCII 图 → 区域掩膜 → Eq.6 高度场 → web/public/world/ 静态资产。
// 运行：npm run bake:world

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NATIONS, OWNER_MAP, TERRAIN_MAP } from '../shared/src/data.js'
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

/**
 * 校验 ASCII 图里出现的每个字符都在合法字符集内。ASCII 图是运营改地图的唯一入口，
 * profiles[key] ?? profiles.p 这类兜底会让拼写错误静默变成平原（或无主陆地），
 * 所以烘焙前必须硬校验，而不是留给 heightfield.ts 的纯函数去宽容处理。
 */
function validateMap(mapName: string, rows: string[], allowed: Set<string>): void {
  const errors: string[] = []
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c]
      if (!allowed.has(ch)) {
        errors.push(`  第 ${r + 1} 行第 ${c + 1} 列：非法字符 '${ch}'`)
      }
    }
  })
  if (errors.length > 0) {
    console.error(`烘焙中止：${mapName} 含有未定义字符`)
    console.error(`  合法字符集：${[...allowed].sort().join('')}`)
    for (const e of errors) console.error(e)
    process.exit(1)
  }
}

validateMap('TERRAIN_MAP（地形图）', TERRAIN_MAP, new Set(Object.keys(TERRAIN_PROFILES)))
validateMap(
  'OWNER_MAP（归属图）',
  OWNER_MAP,
  new Set(['.', '*', ...NATIONS.map(n => n.glyph)]),
)

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
