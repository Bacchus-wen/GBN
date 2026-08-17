// 六棱柱体素几何 · odd-q 垂直偏移布局（flat-top 六边形）
// 顶面为六边形，向下挤出得到左右两个侧面 → 体素积木块的观感。

export const HEX_R = 11          // 六边形外接圆半径
export const GAP = 0.6           // 格间缝隙，让块与块可辨

const W = HEX_R * 2                       // 宽（flat-top）
const H = Math.sqrt(3) * HEX_R            // 高
export const STEP_X = W * 0.75            // 列步进
export const STEP_Y = H                   // 行步进

/** 格子中心坐标（不含挤出高度） */
export function center(col, row) {
  return {
    x: col * STEP_X + HEX_R,
    y: row * STEP_Y + (col % 2 ? STEP_Y / 2 : 0) + H / 2,
  }
}

/** flat-top 六边形的 6 个顶点，顺时针从右顶点开始 */
export function hexPoints(cx, cy, r = HEX_R - GAP) {
  const pts = []
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i)
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return pts
}

export function toPath(pts) {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join('') + 'Z'
}

/**
 * 六棱柱三面。顶点序号（flat-top，y 向下）：
 *   0 右, 1 右下, 2 左下, 3 左, 4 左上, 5 右上
 * 下缘为 2-1（右下）与 3-2（左下）两条边，各向下挤出一个四边形。
 */
export function prism(cx, cy, depth, r = HEX_R - GAP) {
  const p = hexPoints(cx, cy, r)
  const d = ([x, y]) => [x, y + depth]
  return {
    top: toPath(p),
    // 右侧面：顶点 1(右下) → 0(右) 下沉
    right: toPath([p[0], p[1], d(p[1]), d(p[0])]),
    // 左侧面：顶点 2(左下) → 1(右下) 下沉 —— 正面朝观察者
    front: toPath([p[1], p[2], d(p[2]), d(p[1])]),
    left: toPath([p[2], p[3], d(p[3]), d(p[2])]),
  }
}

/** 画布尺寸 */
export function stageSize(cols, rows, maxDepth) {
  return {
    w: (cols - 1) * STEP_X + W,
    h: (rows - 1) * STEP_Y + H + STEP_Y / 2 + maxDepth,
  }
}

/** 邻接（odd-q 垂直布局） */
export function neighbors(col, row) {
  const odd = col % 2 === 1
  return [
    [col, row - 1], [col, row + 1],
    [col - 1, row + (odd ? 0 : -1)], [col - 1, row + (odd ? 1 : 0)],
    [col + 1, row + (odd ? 0 : -1)], [col + 1, row + (odd ? 1 : 0)],
  ]
}

// ---------- 颜色工具：从国家主色 + 地形偏移推导三面明暗 ----------

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16)
  let r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
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

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

/** 返回顶/左/右三面颜色 */
export function faces(baseHex, terrain, { desat = false, shift = 0 } = {}) {
  const c = hexToHsl(baseHex)
  let h = (c.h + (terrain?.hue || 0) + 360) % 360
  let s = clamp(c.s + (terrain?.sat || 0), 0, 100)
  let l = clamp(c.l + (terrain?.lum || 0) + shift, 6, 92)
  if (desat) { s = clamp(s * 0.25, 0, 100); l = clamp(l * 0.6 + 6, 4, 60) }
  const f = (k) => `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${clamp(l * k, 3, 95).toFixed(0)}%)`
  return { top: f(1.0), left: f(0.6), right: f(0.4) }
}

/** 海洋格颜色（不属于任何国家） */
export function seaFaces(row, cols) {
  const l = 12 + (row / cols) * 3
  return {
    top: `hsl(218 46% ${l.toFixed(0)}%)`,
    left: `hsl(218 46% ${(l * 0.7).toFixed(0)}%)`,
    right: `hsl(218 46% ${(l * 0.5).toFixed(0)}%)`,
  }
}

/** 无主陆地 */
export const NEUTRAL_HEX = '#5a6478'
