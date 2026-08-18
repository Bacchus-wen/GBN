// 地貌算子，对应论文 Eq.6 里的 G_{r,j}。
// 每个算子都是纯函数，输出统一归一化到 [0,1]，贡献大小由权重 λ 决定。

export type GeomorphKind = 'ridge' | 'terrace' | 'dune' | 'erode'

/** 山脊：把噪声取绝对值后翻折，零交叉处形成锐利脊线 */
export function ridge(n: number): number {
  return 1 - Math.abs(n)
}

/** 阶地：把连续高度量化成台阶 */
export function terrace(v: number, steps: number): number {
  if (steps <= 1) return v
  return Math.round(v * steps) / steps
}

/** 沙丘：沿指定方向的正弦波，归一化到 [0,1] */
export function dune(x: number, y: number, angle: number, freq: number): number {
  const k = x * Math.cos(angle) + y * Math.sin(angle)
  return (Math.sin(k * freq) + 1) / 2
}

/** 侵蚀：按局部坡度削减高度，不低于 0 */
export function erode(v: number, gradMag: number, k: number): number {
  return Math.max(0, v - k * gradMag * v)
}
