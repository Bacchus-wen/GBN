// 每个地形键的 Eq.6 参数：基准高程 h_r、噪声层 w_{r,k}N_{r,k}、地貌算子 λ_{r,j}G_{r,j}。
// base 沿用 shared/src/data.ts 里 TERRAIN.height 的取值，与既有数据保持一致。

import type { GeomorphKind } from './geomorph'

export interface NoiseLayer { freq: number; amp: number }

export interface OpSpec {
  kind: GeomorphKind
  weight: number
  /** dune 用 */
  freq?: number
  /** dune 用 */
  angle?: number
  /** terrace 用 */
  steps?: number
  /** erode 用 */
  k?: number
}

export interface TerrainProfile {
  base: number
  noise: NoiseLayer[]
  ops: OpSpec[]
}

/** 键与 TERRAIN_MAP / OWNER_MAP 字符对应；'.' 为海洋，'*' 为无主陆地 */
export const TERRAIN_PROFILES: Record<string, TerrainProfile> = {
  '.': { base: -6, noise: [{ freq: 1.5, amp: 0.6 }], ops: [] },
  p: { base: 10, noise: [{ freq: 2, amp: 1.2 }, { freq: 6, amp: 0.4 }], ops: [] },
  f: { base: 13, noise: [{ freq: 3, amp: 1.8 }, { freq: 8, amp: 0.6 }], ops: [] },
  m: {
    base: 20,
    noise: [{ freq: 2.5, amp: 6 }, { freq: 7, amp: 2 }],
    ops: [{ kind: 'ridge', weight: 8 }, { kind: 'erode', weight: 1, k: 0.35 }],
  },
  c: { base: 5, noise: [{ freq: 3, amp: 0.8 }], ops: [] },
  i: {
    base: 11,
    noise: [{ freq: 2, amp: 2 }],
    ops: [{ kind: 'terrace', weight: 3, steps: 5 }],
  },
  r: { base: 5, noise: [{ freq: 9, amp: 1.6 }], ops: [] },
  v: { base: 24, noise: [{ freq: 2, amp: 4 }], ops: [{ kind: 'ridge', weight: 10 }] },
  d: {
    base: 9,
    noise: [{ freq: 2, amp: 1 }],
    ops: [{ kind: 'dune', weight: 4, freq: 10, angle: 0.6 }],
  },
  '*': { base: 8, noise: [{ freq: 2.5, amp: 1.4 }], ops: [] },
}
