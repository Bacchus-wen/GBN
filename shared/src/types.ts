// GBN 领域类型。形状取自 activity-v2/data.js 的 mock 数据，保持一致以便直接迁移。

import type { Placement } from './world/placement.js'

/** 地形键。对应 TERRAIN_MAP 里的字符。 */
export type TerrainKey = 'p' | 'f' | 'm' | 'c' | 'i' | 'r' | 'v' | 'd'

/** 资源类型。领土格按地形产出资源。 */
export type Resource = '耗材' | '木材' | '矿石' | '港口' | '冷凝'

export interface Terrain {
  key: TerrainKey
  name: string
  /** 体素挤出高度。直接影响地图剪影，改地形会看得见。 */
  height: number
  /** 相对国家主色的 HSL 偏移 */
  hue: number
  sat: number
  lum: number
  res: Resource
  icon: string
}

/** 一个陆地格。海洋格不入表。 */
export interface Cell {
  col: number
  row: number
  /** 归属国 id；null = 无主陆地 */
  owner: string | null
  terrain: TerrainKey
}

export type NationStatus = 'active' | 'pending'
export type ContentStatus = 'approved' | 'pending' | 'none'

export interface Member {
  name: string
  avatar: string
  role: string
  gdp: number
}

export interface FleetItem {
  name: string
  kind: '地标' | '舰船' | '吉祥物'
  verified: boolean
}

export interface Nation {
  id: string
  /** 对应 OWNER_MAP 里的字符 */
  glyph: string
  name: string
  flag: string
  color: string
  slogan: string
  desc: string
  status: NationStatus
  gdp: number
  weeklyGdp: number
  memberCount: number
  rank: number
  foundedAt: string
  leader: { name: string; avatar: string; role: string }
  members: Member[]
  fleet: FleetItem[]
  texture: string
  story: string
  storyStatus: ContentStatus
}

/** 争议格：两国同时主张，须管理员裁决 */
export interface Contested {
  col: number
  row: number
  claimants: string[]
  since: string
  note: string
}

export type Origin = 'human' | 'ai'

export interface Landmark {
  /** 世界坐标落点（x/y/z + 法线），来自 placementAt 的拾取结果，而非六角格 col/row */
  placement: Placement
  nationId: string
  name: string
  author: string
  origin: Origin
  status: ContentStatus
  /** Tripo 生成的模型 URL；人工地标为空 */
  modelUrl?: string
}

export type RoleKey = 'citizen' | 'leader' | 'admin'

export interface Role {
  key: RoleKey
  label: string
  user: string
  avatar: string
  nationId: string | null
  title: string
  can: {
    submit: boolean
    /** 核准本国内政：地形、地标、纹理、故事 */
    approveDomestic: boolean
    /** 裁决领土变更、争议格、战争结果 */
    approveTerritory: boolean
  }
  hint: string
}

/** AI 工坊可生成的草案类型 */
export type DraftKind = 'terrain' | 'landmark' | 'texture' | 'story'

/** 审核队列条目类型：草案 + 领土认领 */
export type QueueKind = DraftKind | 'claim'

/** scope 决定进哪一级队列：内政归领袖，领土归管理员 */
export type Scope = 'domestic' | 'territory'

export interface QueueItem {
  id: string
  kind: QueueKind
  scope: Scope
  origin: Origin
  nationId: string
  title: string
  detail: string
  rationale: string
  author?: string
  edited?: boolean
  at?: string
  payload?: {
    terrain?: TerrainKey
    /** 地形上的落点：世界坐标 x/y/z + 法线，取自 placementAt 的拾取结果 */
    placement?: Placement
    text?: string
    cells?: string[]
  }
}

/** AI 草案候选。AI 只出草案，必须人工改写并署名才能提交。 */
export interface AiDraft {
  label: string
  rationale: string
  terrain?: TerrainKey
  text?: string
}
