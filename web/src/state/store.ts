// 应用状态。用 useReducer 单点管理，避免面板间层层传 setter。
import {
  AI_POOL, LANDMARKS, ROLES, TERRAIN, buildCells, cellKey, nationById,
} from '@gbn/shared'
import type {
  Cell, DraftKind, Landmark, Nation, QueueItem, QueueKind, RoleKey, TerrainKey,
} from '@gbn/shared'
import type { LayerKey, MapMode, ViewMode } from './types'

export interface AppState {
  role: RoleKey
  selectedNation: string | null
  selectedCell: string | null
  mode: MapMode
  layer: LayerKey
  view: ViewMode
  showDrafts: boolean
  /** 认领草案：正在圈的格子 */
  draft: Set<string>
  queue: QueueItem[]
  cells: Map<string, Cell>
  landmarks: Landmark[]
  /** AI 候选池游标，保证 demo 可复现 */
  aiCursor: Record<DraftKind, number>
  /** 核准后的国家字段变更。NATIONS 是常量，不就地改。 */
  nationOverrides: Record<string, Partial<Nation>>
  /** 已裁决的争议格 key，裁完不再显示为争议 */
  resolvedDisputes: Set<string>
  log: string[]
  toast: string | null
}

function withOverride(
  cur: Record<string, Partial<Nation>>,
  id: string,
  patch: Partial<Nation>,
): Record<string, Partial<Nation>> {
  return { ...cur, [id]: { ...(cur[id] ?? {}), ...patch } }
}

/** 取国家数据，叠加核准后的变更 */
export function nationView(s: AppState, id: string | null): Nation | undefined {
  const base = nationById(id)
  if (!base) return undefined
  const ov = s.nationOverrides[base.id]
  return ov ? { ...base, ...ov } : base
}

export const initialState: AppState = {
  role: 'citizen',
  selectedNation: 'benchylvania',
  selectedCell: null,
  mode: 'inspect',
  layer: 'owner',
  view: 'board',
  showDrafts: true,
  draft: new Set(),
  queue: [{
    id: 'q-seed', kind: 'landmark', scope: 'domestic', origin: 'ai',
    nationId: 'allabenchia', title: '巫师灯塔',
    detail: '落点 (14,4) · 山地',
    rationale: '山脊格缺少高耸地标，灯塔造型可强化天际线辨识度。',
    author: 'WizardLayer', edited: true, at: '2 小时前',
  }],
  cells: buildCells(),
  landmarks: LANDMARKS.map(l => ({ ...l })),
  aiCursor: { terrain: 0, landmark: 0, texture: 0, story: 0 },
  nationOverrides: {},
  resolvedDisputes: new Set(),
  log: [],
  toast: null,
}

export type Action =
  | { type: 'setRole'; role: RoleKey }
  | { type: 'selectNation'; id: string }
  | { type: 'pickCell'; cell: Cell; additive: boolean }
  | { type: 'setMode'; mode: MapMode }
  | { type: 'setLayer'; layer: LayerKey }
  | { type: 'setView'; view: ViewMode }
  | { type: 'toggleDrafts' }
  | { type: 'clearDraft' }
  | { type: 'submitQueue'; item: QueueItem }
  | { type: 'decide'; id: string; approve: boolean }
  | { type: 'resolveDispute'; col: number; row: number; winner: string }
  | { type: 'advanceAi'; kind: DraftKind }
  | { type: 'toast'; msg: string | null }
  | { type: 'addLandmark'; landmark: Landmark }

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'setRole':
      return { ...s, role: a.role, draft: new Set(), mode: 'inspect' }

    case 'selectNation':
      return { ...s, selectedNation: a.id }

    case 'pickCell': {
      const k = cellKey(a.cell.col, a.cell.row)
      if (s.mode === 'claim') {
        const draft = new Set(s.draft)
        if (draft.has(k)) draft.delete(k)
        else draft.add(k)
        return { ...s, draft, selectedCell: k }
      }
      return {
        ...s,
        selectedCell: k,
        selectedNation: a.cell.owner ?? s.selectedNation,
      }
    }

    case 'setMode':
      return { ...s, mode: a.mode, draft: a.mode === 'inspect' ? new Set() : s.draft }

    case 'setLayer':
      return { ...s, layer: a.layer }

    case 'setView':
      return { ...s, view: a.view }

    case 'toggleDrafts':
      return { ...s, showDrafts: !s.showDrafts }

    case 'clearDraft':
      return { ...s, draft: new Set() }

    case 'submitQueue':
      return {
        ...s,
        queue: [a.item, ...s.queue],
        draft: a.item.kind === 'terrain' ? s.draft : new Set(),
        log: [`${roleOf(s).user} 提交了${labelOf(a.item.kind)}草案`, ...s.log],
      }

    case 'decide': {
      const item = s.queue.find(q => q.id === a.id)
      if (!item) return s
      const queue = s.queue.filter(q => q.id !== a.id)
      let cells = s.cells
      let landmarks = s.landmarks
      let overrides = s.nationOverrides

      if (a.approve) {
        // 地形核准 → 改地图
        if (item.kind === 'terrain' && item.payload?.cell && item.payload.terrain) {
          cells = new Map(cells)
          const cur = cells.get(item.payload.cell)
          if (cur) cells.set(item.payload.cell, { ...cur, terrain: item.payload.terrain })
        }
        // 地标核准 → 落地图钉。种子项是已存在的 pending 地标，改状态而非新增。
        if (item.kind === 'landmark') {
          const seeded = s.landmarks.find(
            l => l.nationId === item.nationId && l.name === item.title && l.status === 'pending',
          )
          if (seeded) {
            landmarks = s.landmarks.map(l => l === seeded ? { ...l, status: 'approved' } : l)
          } else if (item.payload?.cell) {
            const [c, r] = item.payload.cell.split(',').map(Number)
            landmarks = [...s.landmarks, {
              col: c, row: r, nationId: item.nationId,
              name: item.title, author: item.author ?? '—',
              origin: item.origin, status: 'approved',
              modelUrl: item.payload.text,
            }]
          }
        }
        // 纹理 / 故事核准 → 覆盖国家字段（NATIONS 是常量，用 overrides 记录变更）
        if (item.kind === 'texture') {
          overrides = withOverride(overrides, item.nationId, { texture: item.title })
        }
        if (item.kind === 'story') {
          overrides = withOverride(overrides, item.nationId, {
            story: item.payload?.text ?? item.title,
            storyStatus: 'approved',
          })
        }
        // 领土认领核准 → 改归属
        if (item.kind === 'claim' && item.payload?.cells?.length) {
          cells = new Map(cells)
          for (const ck of item.payload.cells) {
            const cur = cells.get(ck)
            if (cur) cells.set(ck, { ...cur, owner: item.nationId })
          }
        }
      } else if (item.kind === 'landmark') {
        // 驳回 pending 地标 → 从地图移除
        landmarks = s.landmarks.filter(
          l => !(l.nationId === item.nationId && l.name === item.title && l.status === 'pending'),
        )
      }

      return {
        ...s, queue, cells, landmarks, nationOverrides: overrides,
        log: [`${a.approve ? '核准' : '驳回'}：${item.title}`, ...s.log],
        toast: a.approve ? '已核准，地图已更新' : '已驳回',
      }
    }

    case 'resolveDispute': {
      const cells = new Map(s.cells)
      const k = cellKey(a.col, a.row)
      const cur = cells.get(k)
      if (cur) cells.set(k, { ...cur, owner: a.winner })
      // 裁决后该格不再是争议格
      const resolved = new Set(s.resolvedDisputes)
      resolved.add(k)
      return {
        ...s, cells, resolvedDisputes: resolved,
        log: [`管理员裁决 ${k} 归 ${nationById(a.winner)?.name}`, ...s.log],
        toast: `格 ${a.col},${a.row} 判归 ${nationById(a.winner)?.name}`,
      }
    }

    case 'advanceAi':
      return { ...s, aiCursor: { ...s.aiCursor, [a.kind]: s.aiCursor[a.kind] + 1 } }

    case 'toast':
      return { ...s, toast: a.msg }

    case 'addLandmark':
      return { ...s, landmarks: [...s.landmarks, a.landmark] }

    default:
      return s
  }
}

export const roleOf = (s: AppState) => ROLES[s.role]

export function nextAiDraft(s: AppState, kind: DraftKind) {
  const pool = AI_POOL[kind]
  return pool[s.aiCursor[kind] % pool.length]
}

const labelOf = (k: QueueKind) =>
  ({ terrain: '地形', landmark: '地标', texture: '纹理', story: '故事', claim: '领土' })[k]

export const terrainName = (t: TerrainKey) => TERRAIN[t].name
