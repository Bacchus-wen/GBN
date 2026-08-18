// 应用状态。用 useReducer 单点管理，避免面板间层层传 setter。
import { AI_POOL, LANDMARKS, ROLES, nationById } from '@gbn/shared'
import type {
  DraftKind, Landmark, Nation, Placement, QueueItem, QueueKind, RoleKey,
} from '@gbn/shared'
import type { LayerKey, ViewMode } from './types'

export interface AppState {
  role: RoleKey
  selectedNation: string | null
  /** 地形上最近一次的落点：坐标 + 法线 */
  selectedPlacement: Placement | null
  /** 落点所属的归属层字符：'.' 海洋、'*' 无主 */
  selectedOwnerGlyph: string
  /** 落点的地貌字符，见 TERRAIN */
  selectedTerrainKey: string
  layer: LayerKey
  view: ViewMode
  queue: QueueItem[]
  landmarks: Landmark[]
  /** AI 候选池游标，保证 demo 可复现 */
  aiCursor: Record<DraftKind, number>
  /** 核准后的国家字段变更。NATIONS 是常量，不就地改。 */
  nationOverrides: Record<string, Partial<Nation>>
  log: string[]
  toast: string | null
  /** 用户的国籍。null 表示无国籍人士。mock 阶段落 localStorage */
  citizenship: string | null
  /** 是否已完成初次引导。二次登入直接进活动页 */
  onboarded: boolean
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

/**
 * mock 阶段的持久化。接口形状按最终后端设计——将来换成真实用户档案时
 * 只替换这两个函数，调用方不动。
 */
function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

function writeStored(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 隐私模式等场景下写不进去，不影响本次会话
  }
}

export const initialState: AppState = {
  role: 'citizen',
  selectedNation: 'benchylvania',
  selectedPlacement: null,
  selectedOwnerGlyph: '.',
  selectedTerrainKey: '.',
  layer: 'owner',
  view: 'board',
  queue: [{
    id: 'q-seed', kind: 'landmark', scope: 'domestic', origin: 'ai',
    nationId: 'allabenchia', title: '巫师灯塔',
    detail: '落点 (14,4) · 山地',
    rationale: '山脊格缺少高耸地标，灯塔造型可强化天际线辨识度。',
    author: 'WizardLayer', edited: true, at: '2 小时前',
  }],
  landmarks: LANDMARKS.map(l => ({ ...l })),
  aiCursor: { terrain: 0, landmark: 0, texture: 0, story: 0 },
  nationOverrides: {},
  log: [],
  toast: null,
  citizenship: readStored('gbn.citizenship', null),
  onboarded: readStored('gbn.onboarded', false),
}

export type Action =
  | { type: 'setRole'; role: RoleKey }
  | { type: 'selectNation'; id: string }
  | { type: 'pickPlacement'; placement: Placement; ownerGlyph: string; terrainKey: string }
  | { type: 'setLayer'; layer: LayerKey }
  | { type: 'setView'; view: ViewMode }
  | { type: 'submitQueue'; item: QueueItem }
  | { type: 'decide'; id: string; approve: boolean }
  | { type: 'advanceAi'; kind: DraftKind }
  | { type: 'toast'; msg: string | null }
  | { type: 'addLandmark'; landmark: Landmark }
  | { type: 'setCitizenship'; nationId: string | null }

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'setRole':
      return { ...s, role: a.role }

    case 'selectNation':
      return { ...s, selectedNation: a.id }

    case 'setCitizenship': {
      writeStored('gbn.citizenship', a.nationId)
      writeStored('gbn.onboarded', true)
      return {
        ...s,
        citizenship: a.nationId,
        onboarded: true,
        selectedNation: a.nationId ?? s.selectedNation,
        toast: a.nationId
          ? `已加入 ${nationById(a.nationId)?.name ?? ''}，你的打印将计入该国 GDP`
          : '你现在是无国籍人士，随时可以加入国家',
      }
    }

    case 'pickPlacement':
      return {
        ...s,
        selectedPlacement: a.placement,
        selectedOwnerGlyph: a.ownerGlyph,
        selectedTerrainKey: a.terrainKey,
      }

    case 'setLayer':
      return { ...s, layer: a.layer }

    case 'setView':
      return { ...s, view: a.view }

    case 'submitQueue':
      return {
        ...s,
        queue: [a.item, ...s.queue],
        log: [`${roleOf(s).user} 提交了${labelOf(a.item.kind)}草案`, ...s.log],
      }

    case 'decide': {
      const item = s.queue.find(q => q.id === a.id)
      if (!item) return s
      const queue = s.queue.filter(q => q.id !== a.id)
      let landmarks = s.landmarks
      let overrides = s.nationOverrides

      if (a.approve) {
        // 地标核准 → 落地图钉。种子项是已存在的 pending 地标，改状态而非新增。
        if (item.kind === 'landmark') {
          const seeded = s.landmarks.find(
            l => l.nationId === item.nationId && l.name === item.title && l.status === 'pending',
          )
          if (seeded) {
            landmarks = s.landmarks.map(l => l === seeded ? { ...l, status: 'approved' } : l)
          } else if (item.payload?.placement) {
            landmarks = [...s.landmarks, {
              placement: item.payload.placement, nationId: item.nationId,
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
      } else if (item.kind === 'landmark') {
        // 驳回 pending 地标 → 从地图移除
        landmarks = s.landmarks.filter(
          l => !(l.nationId === item.nationId && l.name === item.title && l.status === 'pending'),
        )
      }

      return {
        ...s, queue, landmarks, nationOverrides: overrides,
        log: [`${a.approve ? '核准' : '驳回'}：${item.title}`, ...s.log],
        toast: a.approve ? '已核准' : '已驳回',
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
