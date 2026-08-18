// ASCII 图 → 区域掩膜。对应论文 2.2.3 的区域掩膜提取与边界软化：
// 指示函数 → 双线性升采样 → 高斯软化 → 逐像素归一化。
// 归一化保证 Σ_r m_r(x) = 1，这是 Eq.6 成立的前提。

export interface RegionMasks {
  res: number
  /** 区域键，顺序固定；索引即 data 里的平面序号 */
  keys: string[]
  /** 长度 keys.length * res * res */
  data: Float32Array
}

export function maskAt(m: RegionMasks, regionIndex: number, ix: number, iy: number): number {
  return m.data[regionIndex * m.res * m.res + iy * m.res + ix]
}

export function dominantRegion(m: RegionMasks, ix: number, iy: number): number {
  let best = 0
  let bestW = -1
  for (let r = 0; r < m.keys.length; r++) {
    const w = maskAt(m, r, ix, iy)
    if (w > bestW) { bestW = w; best = r }
  }
  return best
}

/** 一维高斯核，半径取 3σ */
function gaussianKernel(sigma: number): Float32Array {
  if (sigma <= 0) return Float32Array.from([1])
  const radius = Math.max(1, Math.ceil(sigma * 3))
  const k = new Float32Array(radius * 2 + 1)
  let sum = 0
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma))
    k[i + radius] = v
    sum += v
  }
  for (let i = 0; i < k.length; i++) k[i] /= sum
  return k
}

/** 可分离高斯模糊，边缘按夹取处理 */
function blur(plane: Float32Array, res: number, sigma: number): Float32Array {
  const k = gaussianKernel(sigma)
  const radius = (k.length - 1) / 2
  const tmp = new Float32Array(res * res)
  const out = new Float32Array(res * res)

  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      let acc = 0
      for (let i = -radius; i <= radius; i++) {
        const sx = Math.min(res - 1, Math.max(0, x + i))
        acc += plane[y * res + sx] * k[i + radius]
      }
      tmp[y * res + x] = acc
    }
  }
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      let acc = 0
      for (let i = -radius; i <= radius; i++) {
        const sy = Math.min(res - 1, Math.max(0, y + i))
        acc += tmp[sy * res + x] * k[i + radius]
      }
      out[y * res + x] = acc
    }
  }
  return out
}

/**
 * @param rows     等宽字符行，一个字符 = 一个源格
 * @param res      输出分辨率（正方形）
 * @param softness 边界软化强度，单位为输出像素的高斯 σ
 */
export function buildMasks(rows: string[], res: number, softness: number): RegionMasks {
  const srcH = rows.length
  const srcW = rows[0].length
  const keys = [...new Set(rows.join('').split(''))].sort()
  const planes = keys.map(() => new Float32Array(res * res))

  for (let y = 0; y < res; y++) {
    const sy = (y / (res - 1)) * (srcH - 1)
    const y0 = Math.floor(sy)
    const y1 = Math.min(srcH - 1, y0 + 1)
    const ty = sy - y0
    for (let x = 0; x < res; x++) {
      const sx = (x / (res - 1)) * (srcW - 1)
      const x0 = Math.floor(sx)
      const x1 = Math.min(srcW - 1, x0 + 1)
      const tx = sx - x0
      const idx = y * res + x
      for (let r = 0; r < keys.length; r++) {
        const ch = keys[r]
        const v00 = rows[y0][x0] === ch ? 1 : 0
        const v10 = rows[y0][x1] === ch ? 1 : 0
        const v01 = rows[y1][x0] === ch ? 1 : 0
        const v11 = rows[y1][x1] === ch ? 1 : 0
        const top = v00 + (v10 - v00) * tx
        const bot = v01 + (v11 - v01) * tx
        planes[r][idx] = top + (bot - top) * ty
      }
    }
  }

  const blurred = planes.map(p => blur(p, res, softness))

  const data = new Float32Array(keys.length * res * res)
  for (let i = 0; i < res * res; i++) {
    let sum = 0
    for (let r = 0; r < keys.length; r++) sum += blurred[r][i]
    if (sum <= 0) { data[i] = 1; continue }
    for (let r = 0; r < keys.length; r++) {
      data[r * res * res + i] = blurred[r][i] / sum
    }
  }

  return { res, keys, data }
}
