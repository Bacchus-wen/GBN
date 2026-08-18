// 六角网格几何 · odd-q 垂直偏移布局（flat-top 六边形）
// 平面坐标算法从 activity-v2/hex.js 原样迁移；3D 版把 y 当作 z，另用 height 作 y 轴。

import { TERRAIN } from './data.js'
import type { Terrain, TerrainKey } from './types.js'

export const HEX_R = 11          // 六边形外接圆半径
export const GAP = 0.6           // 格间缝隙，让块与块可辨

const W = HEX_R * 2                       // 宽（flat-top）
const H = Math.sqrt(3) * HEX_R            // 高
export const STEP_X = W * 0.75            // 列步进
export const STEP_Y = H                   // 行步进

/** 高度缩放：ASCII 数据里的 height 是 SVG 像素，3D 场景按此系数换算 */
export const HEIGHT_SCALE = 0.55

/** 格子中心坐标（平面）。3D 场景里 y 映射为 z。 */
export function center(col: number, row: number): { x: number; y: number } {
  return {
    x: col * STEP_X + HEX_R,
    y: row * STEP_Y + (col % 2 ? STEP_Y / 2 : 0) + H / 2,
  }
}

/** 地图中心，用于把整块大陆板移到世界原点 */
export function mapCenter(cols: number, rows: number): { x: number; z: number } {
  const a = center(0, 0)
  const b = center(cols - 1, rows - 1)
  return { x: (a.x + b.x) / 2, z: (a.y + b.y) / 2 }
}

/** flat-top 六边形的 6 个顶点，顺时针从右顶点开始 */
export function hexPoints(cx: number, cy: number, r = HEX_R - GAP): [number, number][] {
  const pts: [number, number][] = []
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i)
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return pts
}

/**
 * 邻接（odd-q 垂直布局）。3D 版原样复用 —— 这是领土、边界、连通性校验的基础。
 */
export function neighbors(col: number, row: number): [number, number][] {
  const odd = col % 2 === 1
  return [
    [col, row - 1], [col, row + 1],
    [col - 1, row + (odd ? 0 : -1)], [col - 1, row + (odd ? 1 : 0)],
    [col + 1, row + (odd ? 0 : -1)], [col + 1, row + (odd ? 1 : 0)],
  ]
}

/**
 * 六条边对应的邻居，顺序与 hexPoints 的顶点边一一对应。
 * 边 i 连接顶点 i → i+1；方向：0=右下 1=下 2=左下 3=左上 4=上 5=右上
 * borderPath 依赖这个顺序，从 activity-v2/app.js:91 迁移。
 */
export function edgeNeighbors(col: number, row: number): [number, number][] {
  const odd = col % 2 === 1
  return [
    [col + 1, row + (odd ? 1 : 0)],   // 边 0-1 右下
    [col, row + 1],                     // 边 1-2 下
    [col - 1, row + (odd ? 1 : 0)],   // 边 2-3 左下
    [col - 1, row + (odd ? 0 : -1)],  // 边 3-4 左上
    [col, row - 1],                     // 边 4-5 上
    [col + 1, row + (odd ? 0 : -1)],  // 边 5-0 右上
  ]
}

/** 地形挤出高度（已缩放，供 three.js 用） */
export function cellHeight(t: TerrainKey): number {
  return (TERRAIN[t]?.height ?? 10) * HEIGHT_SCALE
}

// ---------- 颜色工具：从国家主色 + 地形偏移推导 ----------

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (mx + mn) / 2
  const dd = mx - mn
  if (dd) {
    s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn)
    if (mx === r) h = ((g - b) / dd + (g < b ? 6 : 0)) * 60
    else if (mx === g) h = ((b - r) / dd + 2) * 60
    else h = ((r - g) / dd + 4) * 60
  }
  return { h, s: s * 100, l: l * 100 }
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

/**
 * 单格颜色。2D 版返回三面明暗，3D 版只需一个 base color —— three.js 自己算光照。
 */
export function cellColor(
  baseHex: string,
  terrain: Terrain | undefined,
  { desat = false, shift = 0 }: { desat?: boolean; shift?: number } = {},
): string {
  const c = hexToHsl(baseHex)
  const h = (c.h + (terrain?.hue || 0) + 360) % 360
  let s = clamp(c.s + (terrain?.sat || 0), 0, 100)
  let l = clamp(c.l + (terrain?.lum || 0) + shift, 6, 92)
  if (desat) { s = clamp(s * 0.25, 0, 100); l = clamp(l * 0.6 + 6, 4, 60) }
  return `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}%)`
}

/** 无主陆地 */
export const NEUTRAL_HEX = '#5a6478'

/** 海面色（3D 版用一整块平面，不再逐格画海洋） */
export const SEA_HEX = '#101a2e'
