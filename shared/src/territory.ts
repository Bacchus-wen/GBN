// 领土计算：归属、资源、边界、认领校验。
// 算法从 activity-v2/app.js 迁移（borderPath:82 / validateClaim:109），
// 差别只在 borderPath 返回边段数组而非 SVG path —— 3D 版拿它生成 LineSegments。

import { RESOURCE_ORDER, TERRAIN, cellKey, nationById, parseCellKey } from './data.js'
import { HEX_R, center, edgeNeighbors, hexPoints, neighbors } from './hex.js'
import type { Cell, Contested, Resource } from './types.js'

export function territoryOf(cells: Map<string, Cell>, nid: string): Cell[] {
  return [...cells.values()].filter(c => c.owner === nid)
}

export function resourcesOf(cells: Map<string, Cell>, nid: string): Record<Resource, number> {
  const out = {} as Record<Resource, number>
  RESOURCE_ORDER.forEach(k => { out[k] = 0 })
  territoryOf(cells, nid).forEach(c => { out[TERRAIN[c.terrain].res] += 1 })
  return out
}

export function contestedOf(contested: Contested[], nid: string): Contested[] {
  return contested.filter(x => x.claimants.includes(nid))
}

/** 一条边界线段（平面坐标；3D 版把 y 当 z，并抬到格子顶面高度） */
export interface EdgeSegment {
  ax: number; ay: number
  bx: number; by: number
  /** 所属格，用于取顶面高度 */
  col: number; row: number
}

/**
 * 边界描边：territory 的外轮廓（逐格取未被同国占据的那条边）。
 * 与 2D 版同一算法，只是输出线段而非 path 字符串。
 */
export function borderSegments(cells: Map<string, Cell>, nid: string): EdgeSegment[] {
  const own = new Set(territoryOf(cells, nid).map(c => cellKey(c.col, c.row)))
  const segs: EdgeSegment[] = []
  for (const ck of own) {
    const [c, r] = parseCellKey(ck)
    const { x, y } = center(c, r)
    const p = hexPoints(x, y, HEX_R - 0.6)
    edgeNeighbors(c, r).forEach(([nc, nr], i) => {
      if (own.has(cellKey(nc, nr))) return
      const a = p[i], b = p[(i + 1) % 6]
      segs.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], col: c, row: r })
    })
  }
  return segs
}

/**
 * 认领校验：必须与本国既有领土相邻，且不能抢已属他国的格。
 * 飞地一律拒绝（需管理员特批）。
 */
export function validateClaim(
  cells: Map<string, Cell>,
  draft: Set<string>,
  nid: string,
): string[] {
  const own = new Set(territoryOf(cells, nid).map(c => cellKey(c.col, c.row)))
  const errs: string[] = []
  if (!draft.size) errs.push('尚未选择任何格子。')
  for (const ck of draft) {
    const cell = cells.get(ck)
    if (!cell) { errs.push(`${ck} 是海域，不可认领。`); continue }
    if (cell.owner && cell.owner !== nid) {
      errs.push(`${ck} 已属 ${nationById(cell.owner)?.name ?? '他国'}，需提交争议而非认领。`)
    }
  }
  // 连通性：每格至少与本国领土或本次草案相邻
  const pool = new Set([...own, ...draft])
  for (const ck of draft) {
    const [c, r] = parseCellKey(ck)
    const touch = neighbors(c, r).some(([nc, nr]) => {
      const k = cellKey(nc, nr)
      return pool.has(k) && k !== ck
    })
    if (!touch) errs.push(`${ck} 与本国领土不相邻，飞地需管理员特批。`)
  }
  return errs
}
