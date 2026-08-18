// 2D value noise + fbm。不依赖任何浏览器 API。

const TABLE = 256
const MASK = TABLE - 1

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * 用给定 PRNG 构造确定的 2D value noise 场，输出 [-1,1]。
 * 值表在构造时一次生成，之后采样是纯函数。
 */
export function makeValueNoise2D(rand: () => number): (x: number, y: number) => number {
  const vals = new Float64Array(TABLE * TABLE)
  for (let i = 0; i < vals.length; i++) vals[i] = rand() * 2 - 1

  const at = (ix: number, iy: number) => vals[((iy & MASK) * TABLE) + (ix & MASK)]

  return (x: number, y: number) => {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = fade(x - x0)
    const fy = fade(y - y0)
    const top = lerp(at(x0, y0), at(x0 + 1, y0), fx)
    const bot = lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), fx)
    return lerp(top, bot, fy)
  }
}

/** 分形叠加，归一化到 [-1,1] */
export function fbm(
  noise: (x: number, y: number) => number,
  x: number,
  y: number,
  octaves: number,
  lacunarity: number,
  gain: number,
): number {
  let sum = 0
  let amp = 1
  let freq = 1
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq, y * freq)
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return norm > 0 ? sum / norm : 0
}
