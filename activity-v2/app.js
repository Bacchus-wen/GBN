// GBN 世界地图 · 应用逻辑（零依赖，原生 DOM）
import {
  MAP_W, MAP_H, OWNER_MAP, TERRAIN_MAP, TERRAIN, RESOURCE_ORDER,
  NATIONS, CONTESTED, LANDMARKS, ROLES, AI_POOL,
} from './data.js'
import {
  center, hexPoints, toPath, prism, stageSize, neighbors,
  faces, seaFaces, NEUTRAL_HEX, HEX_R,
} from './hex.js'

const SVGNS = 'http://www.w3.org/2000/svg'
const byId = (id) => NATIONS.find(n => n.id === id)
const byGlyph = (g) => NATIONS.find(n => n.glyph === g)
const fmt = (v) => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v)
const key = (c, r) => `${c},${r}`

// ============================================================
// 状态
// ============================================================

const S = {
  role: 'citizen',
  selected: 'benchylvania',
  selectedCell: null,
  mode: 'inspect',            // inspect | claim
  layer: 'owner',             // owner | terrain | resource
  showDrafts: true,
  claimDraft: new Set(),      // 认领草案：正在圈的格子
  queue: [],                  // 审核队列
  cells: new Map(),           // "c,r" -> { col,row,owner,terrain }
  aiCursor: { terrain: 0, landmark: 0, texture: 0, story: 0 },
  landmarks: LANDMARKS.map(l => ({ ...l, id: `lm-${l.col}-${l.row}` })),
  log: [],
}

// 从 ASCII 图构建格子表
for (let r = 0; r < MAP_H; r++) {
  for (let c = 0; c < MAP_W; c++) {
    const og = OWNER_MAP[r][c]
    const tg = TERRAIN_MAP[r][c]
    if (og === '.') continue                       // 海洋
    S.cells.set(key(c, r), {
      col: c, row: r,
      owner: og === '*' ? null : (byGlyph(og)?.id ?? null),
      terrain: TERRAIN[tg] ? tg : 'p',
    })
  }
}

const contestedAt = new Map(CONTESTED.map(x => [key(x.col, x.row), x]))
const role = () => ROLES[S.role]

// 初始队列：一个待审的 AI 地标
S.queue.push({
  id: 'q-seed', kind: 'landmark', scope: 'domestic', origin: 'ai',
  nationId: 'allabenchia', title: '巫师灯塔',
  detail: '落点 (14,4) · 山地',
  rationale: '山脊格缺少高耸地标，灯塔造型可强化天际线辨识度。',
  author: 'WizardLayer', edited: true, at: '2 小时前',
})

// ============================================================
// 派生计算
// ============================================================

function territoryOf(nid) {
  return [...S.cells.values()].filter(c => c.owner === nid)
}

function resourcesOf(nid) {
  const out = {}
  RESOURCE_ORDER.forEach(k => out[k] = 0)
  territoryOf(nid).forEach(c => { out[TERRAIN[c.terrain].res] += 1 })
  return out
}

function contestedOf(nid) {
  return CONTESTED.filter(x => x.claimants.includes(nid))
}

/** 边界描边：territory 的外轮廓（逐格取未被同国占据的那条边） */
function borderPath(nid) {
  const own = new Set(territoryOf(nid).map(c => key(c.col, c.row)))
  const segs = []
  for (const ck of own) {
    const [c, r] = ck.split(',').map(Number)
    const { x, y } = center(c, r)
    const p = hexPoints(x, y, HEX_R - 0.6)
    // 邻居顺序与顶点边一一对应（flat-top, odd-q）
    // 边 i 连接顶点 i → i+1；对应方向：0=右下,1=下,2=左下,3=左上,4=上,5=右上
    const dirs = [
      [c + 1, r + (c % 2 ? 1 : 0)],   // 边 0-1 右下
      [c, r + 1],                       // 边 1-2 下
      [c - 1, r + (c % 2 ? 1 : 0)],   // 边 2-3 左下
      [c - 1, r + (c % 2 ? 0 : -1)],  // 边 3-4 左上
      [c, r - 1],                       // 边 4-5 上
      [c + 1, r + (c % 2 ? 0 : -1)],  // 边 5-0 右上
    ]
    dirs.forEach(([nc, nr], i) => {
      if (own.has(key(nc, nr))) return
      const a = p[i], b = p[(i + 1) % 6]
      segs.push(`M${a[0].toFixed(2)},${a[1].toFixed(2)}L${b[0].toFixed(2)},${b[1].toFixed(2)}`)
    })
  }
  return segs.join('')
}

/** 认领校验：必须与本国既有领土相邻，且不能抢已属他国的格 */
function validateClaim(cells, nid) {
  const own = new Set(territoryOf(nid).map(c => key(c.col, c.row)))
  const errs = []
  if (!cells.size) errs.push('尚未选择任何格子。')
  for (const ck of cells) {
    const cell = S.cells.get(ck)
    if (!cell) { errs.push(`${ck} 是海域，不可认领。`); continue }
    if (cell.owner && cell.owner !== nid) {
      errs.push(`${ck} 已属 ${byId(cell.owner).name}，需提交争议而非认领。`)
    }
  }
  // 连通性：每格至少与本国领土或本次草案相邻
  const pool = new Set([...own, ...cells])
  for (const ck of cells) {
    const [c, r] = ck.split(',').map(Number)
    const touch = neighbors(c, r).some(([nc, nr]) => pool.has(key(nc, nr)) && key(nc, nr) !== ck)
    if (!touch) errs.push(`${ck} 与本国领土不相邻，飞地需管理员特批。`)
  }
  return errs
}

function nextAI(kind) {
  const pool = AI_POOL[kind]
  const item = pool[S.aiCursor[kind] % pool.length]
  S.aiCursor[kind]++
  return item
}

// ============================================================
// DOM 工具
// ============================================================

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v
    else if (k === 'html') n.innerHTML = v
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v)
    else if (v !== null && v !== false && v !== undefined) n.setAttribute(k, v)
  }
  kids.flat().forEach(k => k != null && n.append(k.nodeType ? k : document.createTextNode(k)))
  return n
}

function svg(tag, attrs = {}) {
  const n = document.createElementNS(SVGNS, tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v)
    else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v)
  }
  return n
}

let toastTimer
function toast(msg) {
  document.querySelector('.toast')?.remove()
  const t = el('div', { class: 'toast', role: 'status' }, msg)
  document.body.append(t)
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => t.remove(), 2600)
}

// ============================================================
// 地图渲染
// ============================================================

function renderMap() {
  const maxDepth = Math.max(...Object.values(TERRAIN).map(t => t.height))
  const { w, h } = stageSize(MAP_W, MAP_H, maxDepth)
  const root = svg('svg', {
    class: 'map-svg', viewBox: `0 0 ${w} ${h}`,
    role: 'group', 'aria-label': 'GBN 世界地图',
  })

  // 海洋波纹
  const seaG = svg('g', { 'aria-hidden': 'true' })
  for (let i = 1; i < 6; i++) {
    seaG.append(svg('path', {
      d: `M0 ${i * h / 6} Q ${w / 4} ${i * h / 6 - 4} ${w / 2} ${i * h / 6} T ${w} ${i * h / 6}`,
      fill: 'none', stroke: '#2b4670', 'stroke-width': 0.7, opacity: 0.5,
    }))
  }
  root.append(seaG)

  // 绘制顺序：先上后下、先左后右，保证前排块遮住后排侧面
  const cells = [...S.cells.values()].sort((a, b) =>
    (a.row - b.row) || (a.col - b.col))

  const claimNid = role().nationId

  for (const cell of cells) {
    const { col, row } = cell
    const t = TERRAIN[cell.terrain]
    const { x, y } = center(col, row)
    const depth = t.height
    const g3 = prism(x, y, depth)

    const nat = cell.owner ? byId(cell.owner) : null
    const inDraft = S.claimDraft.has(key(col, row))
    const ct = contestedAt.get(key(col, row))

    // 图层决定颜色来源
    let base = nat ? nat.color : NEUTRAL_HEX
    let desat = false
    if (S.layer === 'terrain') { base = '#7d8798' }
    if (S.layer === 'resource') {
      const rc = { 耗材: '#8b93a5', 木材: '#3ddc6b', 矿石: '#c46bff', 港口: '#2bd9f0', 冷凝: '#4a8dff' }
      base = rc[t.res] || NEUTRAL_HEX
    }
    if (S.layer === 'owner' && !nat) desat = true

    const f = faces(base, t, { desat, shift: inDraft ? 14 : 0 })

    const g = svg('g', {
      class: 'hex-cell', tabindex: '0', role: 'button',
      'aria-label': `${col},${row} ${nat ? nat.name : '无主'} ${t.name}${ct ? ' 争议中' : ''}`,
    })
    g.append(svg('path', { class: 'hex-side', d: g3.right, fill: f.right }))
    g.append(svg('path', { class: 'hex-side', d: g3.front, fill: f.left }))
    g.append(svg('path', { class: 'hex-side', d: g3.left, fill: f.left }))
    g.append(svg('path', { class: 'hex-top', d: g3.top, fill: f.top }))

    // 地形图标
    if (S.layer !== 'owner' || t.height >= 13) {
      const tx = svg('text', { class: 'hex-label', x, y: y + 1.6 })
      tx.textContent = t.icon
      g.append(tx)
    }

    const act = () => onCell(col, row)
    g.addEventListener('click', act)
    g.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act() }
    })
    root.append(g)

    if (inDraft) root.append(svg('path', { class: 'hex-draft', d: g3.top }))
    if (ct) root.append(svg('path', { class: 'hex-contested', d: g3.top }))
  }

  // 国界描边
  for (const n of NATIONS) {
    const d = borderPath(n.id)
    if (!d) continue
    const sel = n.id === S.selected
    root.append(svg('path', {
      d, fill: 'none',
      stroke: sel ? '#ffc247' : '#0b0d12',
      'stroke-width': sel ? 2.2 : 1.4,
      'stroke-linejoin': 'round',
      'stroke-dasharray': n.status === 'pending' ? '3 2' : null,
      'pointer-events': 'none',
      opacity: S.layer === 'owner' ? 1 : 0.45,
    }))
  }

  // 地标标记
  for (const lm of S.landmarks) {
    if (lm.status === 'pending' && !S.showDrafts) continue
    const { x, y } = center(lm.col, lm.row)
    const pend = lm.status === 'pending'
    const g = svg('g', { class: 'lm-pin' })
    g.append(svg('rect', {
      x: x - 3, y: y - 12, width: 6, height: 6,
      fill: pend ? '#c46bff' : '#ffc247',
      stroke: '#0b0d12', 'stroke-width': 1,
    }))
    g.append(svg('path', {
      d: `M${x},${y - 6}L${x},${y - 1}`,
      stroke: '#0b0d12', 'stroke-width': 1.4,
    }))
    root.append(g)
  }

  // 选中格高亮
  if (S.selectedCell) {
    const [c, r] = S.selectedCell.split(',').map(Number)
    const cell = S.cells.get(S.selectedCell)
    if (cell) {
      const { x, y } = center(c, r)
      root.append(svg('path', {
        class: 'hex-sel', d: prism(x, y, TERRAIN[cell.terrain].height).top,
      }))
    }
  }

  return root
}

function onCell(col, row) {
  const ck = key(col, row)
  const cell = S.cells.get(ck)
  if (!cell) return

  if (S.mode === 'claim') {
    if (!role().nationId) { toast('管理员无本国领土，请切换为国民或领袖'); return }
    S.claimDraft.has(ck) ? S.claimDraft.delete(ck) : S.claimDraft.add(ck)
    render()
    return
  }

  S.selectedCell = ck
  if (cell.owner) S.selected = cell.owner
  render()
}

// ============================================================
// 侧栏：国家详情
// ============================================================

function nationPanel() {
  const n = byId(S.selected)
  if (!n) return el('div', { class: 'panel p14 tm' }, '从地图选择一个国家')

  const terr = territoryOf(n.id)
  const res = resourcesOf(n.id)
  const disp = contestedOf(n.id)
  const maxRes = Math.max(1, ...Object.values(res))

  const box = el('section', { class: 'panel' })

  // 头部：国旗 + 名称 + 领袖
  box.append(el('div', { class: 'nat-head' },
    el('div', { class: 'f g12 ai' },
      el('div', { class: 'nat-flag', style: `background:${n.color}` }, n.flag),
      el('div', { class: 'f1' },
        el('div', { class: 'f g6 ai fw' },
          el('h2', { class: 'disp s15' }, n.name),
          n.status === 'pending' ? el('span', { class: 'tag tag-pending' }, '筹备中') : null,
        ),
        el('div', { class: 's11 tm mt4' }, n.slogan),
      ),
    ),
    el('div', { class: 'f g8 ai mt12' },
      el('div', { class: 'avatar' }, n.leader.avatar),
      el('div', { class: 'f1' },
        el('div', { class: 's12 b ti' }, n.leader.name),
        el('div', { class: 's10 tm' }, n.leader.role),
      ),
      el('span', { class: 'tag' }, '领袖'),
    ),
  ))

  // 四格数据
  box.append(el('div', { class: 'stat-grid' },
    stat('GDP', fmt(n.gdp)),
    stat('本周', '+' + fmt(n.weeklyGdp)),
    stat('国民', n.memberCount),
    stat('疆域', terr.length + ' 格'),
  ))

  // 资源
  box.append(sub('资源禀赋', `按 ${terr.length} 格地形统计`))
  RESOURCE_ORDER.forEach(k => {
    box.append(el('div', { class: 'res-row' },
      el('span', { class: 'res-name' }, k),
      el('div', { class: 'bar-track f1' },
        el('div', {
          class: 'bar-fill',
          style: `width:${res[k] / maxRes * 100}%;background:${n.color}`,
        })),
      el('span', { class: 's11 mono-num tm', style: 'width:18px;text-align:right' }, res[k]),
    ))
  })

  // 争议
  if (disp.length) {
    box.append(sub('领土争议', '须管理员裁决'))
    disp.forEach(d => {
      const other = d.claimants.find(x => x !== n.id)
      box.append(el('div', { class: 'p12', style: 'border-bottom:1px solid var(--line)' },
        el('div', { class: 'f g6 ai fw' },
          el('span', { class: 'tag tag-hot' }, `格 ${d.col},${d.row}`),
          el('span', { class: 's11 ti b' }, 'vs ' + byId(other).name),
          el('span', { class: 's10 tm' }, d.since),
        ),
        el('div', { class: 's11 tm mt6' }, d.note),
        role().can.approveTerritory
          ? el('div', { class: 'f g6 mt8' },
              el('button', {
                class: 'btn btn-sm btn-teal',
                onclick: () => resolveDispute(d, n.id),
              }, `判归 ${n.name}`),
              el('button', {
                class: 'btn btn-sm',
                onclick: () => resolveDispute(d, other),
              }, `判归 ${byId(other).name}`),
            )
          : el('div', { class: 's10 tm mt6' }, '⚖ 仅社区管理员可裁决'),
      ))
    })
  }

  // 舰队 / 地标
  box.append(sub('代表舰队与地标', '打印核验后计入 GDP'))
  n.fleet.forEach(f => {
    box.append(el('div', { class: 'row' },
      el('span', { class: 'tag' }, f.kind),
      el('span', { class: 'f1 s12 ti' }, f.name),
      f.verified
        ? el('span', { class: 'tag tag-ok' }, '✓ 已核验')
        : el('span', { class: 'tag tag-pending' }, '待核验'),
    ))
  })

  // 国民
  box.append(sub('国民贡献榜', `${n.memberCount} 名国民`))
  n.members.forEach(m => {
    box.append(el('div', { class: 'row' },
      el('div', { class: 'avatar' }, m.avatar),
      el('div', { class: 'f1' },
        el('div', { class: 's12 ti b' }, m.name),
        el('div', { class: 's10 tm' }, m.role),
      ),
      el('span', { class: 's11 mono-num', style: `color:${n.color}` }, '+' + fmt(m.gdp)),
    ))
  })

  // 背景故事
  box.append(sub('国家纹理与背景', 'AI 可生成草案，署名由人工负责'))
  box.append(el('div', { class: 'p12' },
    el('div', { class: 'f g6 ai' },
      el('span', { class: 'tag' }, '纹理'),
      el('span', { class: 's11 ti' }, n.texture),
    ),
    n.story
      ? el('p', { class: 's11 tm mt8', style: 'line-height:1.75' }, n.story)
      : el('p', { class: 's11 tm mt8' }, '尚无背景故事。'),
  ))

  return box
}

function stat(k, v) {
  return el('div', { class: 'stat' },
    el('div', { class: 'stat-k' }, k),
    el('div', { class: 'stat-v mono-num' }, String(v)),
  )
}

function sub(title, note) {
  return el('div', { class: 'bar' },
    el('span', { class: 'kicker' }, title),
    note ? el('span', { class: 's10 tm', style: 'margin-left:auto' }, note) : null,
  )
}

// ============================================================
// AI 工坊
// ============================================================

function aiWorkshop() {
  const box = el('section', { class: 'panel' })
  box.append(sub('AI 营造工坊', 'AI 只出草案'))

  box.append(el('div', { class: 'p12' },
    el('p', { class: 's11 tm' },
      'AI 提供创意参考，不替代原创。草案必须由人工改写并署名后才能提交；提交后进入审核链。'),
  ))

  const kinds = [
    { k: 'terrain', label: '地形', scope: 'domestic', need: 'cell' },
    { k: 'landmark', label: '地标', scope: 'domestic', need: 'cell' },
    { k: 'texture', label: '国家纹理', scope: 'domestic' },
    { k: 'story', label: '背景故事', scope: 'domestic' },
  ]

  const grid = el('div', { class: 'p12 f fw g6', style: 'border-top:2px solid var(--line)' })
  kinds.forEach(kd => {
    grid.append(el('button', {
      class: 'btn btn-sm',
      onclick: () => openDraft(kd),
    }, '✦ ' + kd.label))
  })
  box.append(grid)

  box.append(el('div', { class: 'p12 s10 tm', style: 'border-top:2px solid var(--line)' },
    role().hint))

  return box
}

function openDraft(kd) {
  const nid = role().nationId
  if (!nid) { toast('管理员无本国，切换为国民或领袖再生成'); return }

  if (kd.need === 'cell' && !S.selectedCell) {
    toast('请先在地图上点选一个格子')
    return
  }
  if (kd.need === 'cell') {
    const cell = S.cells.get(S.selectedCell)
    if (cell.owner !== nid) { toast('只能在本国领土上营造'); return }
  }

  const ai = nextAI(kd.k)
  const n = byId(nid)

  const scrim = el('div', { class: 'scrim', onclick: e => { if (e.target === scrim) scrim.remove() } })
  const m = el('div', { class: 'modal' })

  m.append(el('div', { class: 'bar' },
    el('span', { class: 'tag tag-ai' }, '✦ AI 草案'),
    el('span', { class: 'kicker' }, kd.label),
    el('button', { class: 'btn btn-sm', style: 'margin-left:auto', onclick: () => scrim.remove() }, '✕'),
  ))

  m.append(el('div', { class: 'p14' },
    el('div', { class: 's10 kicker' }, 'AI 提议'),
    el('div', { class: 's15 disp mt4' }, ai.label),
    el('div', { class: 'rationale' }, '理由：' + ai.rationale),
    kd.need === 'cell'
      ? el('div', { class: 's10 tm mt8' }, '落点 ' + S.selectedCell)
      : null,
  ))

  // 人工改写区 —— 这是硬约束：不改写不能提交
  const ta = el('textarea', {
    rows: kd.k === 'story' ? 5 : 2,
    class: 'inset p12',
    style: 'width:100%;font:inherit;color:var(--ink);resize:vertical',
    placeholder: '在此改写为你自己的表述（必填，AI 原文不可直接提交）',
  })
  ta.value = ''

  const warn = el('div', { class: 's10 mt6', style: 'color:var(--gold)' },
    '⚠ 必须改写后才能提交。这是「AI 提供参考而非替代原创」的硬约束。')

  m.append(el('div', { class: 'p14', style: 'border-top:2px solid var(--line)' },
    el('div', { class: 's10 kicker' }, '你的改写 · 署名 ' + role().user),
    kd.k === 'story' && ai.text
      ? el('div', { class: 'rationale mt6', style: 'border-left-color:var(--line-hot)' },
          'AI 原文供参考：' + ai.text)
      : null,
    el('div', { class: 'mt6' }, ta),
    warn,
  ))

  const submit = el('button', { class: 'btn btn-primary', disabled: true }, '提交审核')
  ta.addEventListener('input', () => {
    const ok = ta.value.trim().length >= 4 && ta.value.trim() !== (ai.text || '').trim()
    submit.disabled = !ok
  })
  submit.addEventListener('click', () => {
    S.queue.unshift({
      id: 'q' + S.queue.length + '-' + kd.k,
      kind: kd.k, scope: kd.scope, origin: 'ai',
      nationId: nid, title: ta.value.trim().slice(0, 40),
      detail: kd.need === 'cell' ? `落点 ${S.selectedCell}` : n.name,
      rationale: ai.rationale,
      payload: { terrain: ai.terrain, cell: S.selectedCell, text: ta.value.trim() },
      author: role().user, edited: true, at: '刚刚',
    })
    scrim.remove()
    toast('草案已提交审核')
    render()
  })

  m.append(el('div', { class: 'p14 f g6 jb', style: 'border-top:2px solid var(--line)' },
    el('span', { class: 's10 tm' }, kd.scope === 'domestic' ? '内政 → 领袖核准' : '跨国 → 管理员裁决'),
    submit,
  ))

  scrim.append(m)
  document.body.append(scrim)
  ta.focus()
}

// ============================================================
// 审核队列
// ============================================================

function reviewQueue() {
  const box = el('section', { class: 'panel' })
  box.append(sub('审核队列', S.queue.length + ' 项待处理'))

  if (!S.queue.length) {
    box.append(el('div', { class: 'p14 s11 tm' }, '队列为空。'))
    return box
  }

  S.queue.forEach(q => {
    const canAct = q.scope === 'territory'
      ? role().can.approveTerritory
      : role().can.approveDomestic && (role().nationId === q.nationId || role().can.approveTerritory)

    const n = byId(q.nationId)
    box.append(el('div', { class: 'queue-item' },
      el('div', { class: 'f g6 ai fw' },
        el('span', { class: q.origin === 'ai' ? 'tag tag-ai' : 'tag tag-human' },
          q.origin === 'ai' ? '✦ AI 草案' : '✎ 原创'),
        el('span', { class: 'tag' }, q.scope === 'territory' ? '跨国·领土' : '内政'),
        el('span', { class: 's10 tm', style: 'margin-left:auto' }, q.at),
      ),
      el('div', { class: 's12 ti b mt6' }, q.title),
      el('div', { class: 's10 tm mt4' }, `${n ? n.flag + ' ' + n.name : ''} · ${q.detail} · 署名 ${q.author}`),
      q.rationale ? el('div', { class: 'rationale' }, 'AI 理由：' + q.rationale) : null,
      el('div', { class: 'f g6 mt8 fw' },
        canAct
          ? [
              el('button', { class: 'btn btn-sm btn-teal', onclick: () => decide(q, true) }, '✓ 核准'),
              el('button', { class: 'btn btn-sm', onclick: () => decide(q, false) }, '✕ 驳回'),
            ]
          : el('div', { class: 's10 tm' },
              q.scope === 'territory' ? '⚖ 待社区管理员裁决' : '⚖ 待国家领袖核准'),
      ),
    ))
  })

  return box
}

function decide(q, ok) {
  S.queue = S.queue.filter(x => x.id !== q.id)
  if (ok) {
    if (q.kind === 'terrain' && q.payload?.cell && q.payload.terrain) {
      const cell = S.cells.get(q.payload.cell)
      if (cell) cell.terrain = q.payload.terrain
    }
    if (q.kind === 'landmark' && q.payload?.cell) {
      const [c, r] = q.payload.cell.split(',').map(Number)
      S.landmarks.push({
        id: 'lm' + S.landmarks.length, col: c, row: r,
        nationId: q.nationId, name: q.title, author: q.author,
        origin: q.origin, status: 'approved',
      })
    }
    if (q.kind === 'landmark' && q.id === 'q-seed') {
      const lm = S.landmarks.find(l => l.name === '巫师灯塔')
      if (lm) lm.status = 'approved'
    }
    if (q.kind === 'texture') {
      const n = byId(q.nationId); if (n) n.texture = q.title
    }
    if (q.kind === 'story') {
      const n = byId(q.nationId); if (n) { n.story = q.payload.text; n.storyStatus = 'approved' }
    }
    if (q.kind === 'claim' && q.payload?.cells) {
      q.payload.cells.forEach(ck => {
        const cell = S.cells.get(ck); if (cell) cell.owner = q.nationId
      })
    }
  } else if (q.id === 'q-seed') {
    S.landmarks = S.landmarks.filter(l => l.name !== '巫师灯塔')
  }
  toast(ok ? '已核准，地图已更新' : '已驳回')
  render()
}

function resolveDispute(d, winner) {
  const cell = S.cells.get(key(d.col, d.row))
  if (cell) cell.owner = winner
  const i = CONTESTED.indexOf(d)
  if (i >= 0) CONTESTED.splice(i, 1)
  contestedAt.delete(key(d.col, d.row))
  toast(`格 ${d.col},${d.row} 判归 ${byId(winner).name}`)
  render()
}

// ============================================================
// 领土认领面板
// ============================================================

function claimPanel() {
  const nid = role().nationId
  const box = el('section', { class: 'panel' })
  box.append(sub('领土认领', nid ? byId(nid).name : '无本国'))

  if (!nid) {
    box.append(el('div', { class: 'p14 s11 tm' }, '管理员不持有领土。切换身份以认领。'))
    return box
  }

  const errs = validateClaim(S.claimDraft, nid)
  box.append(el('div', { class: 'p12' },
    el('p', { class: 's11 tm' },
      S.mode === 'claim'
        ? '点击地图上的格子圈地。必须与本国领土相邻。'
        : '开启「圈地」模式后可在地图上选格。'),
    el('div', { class: 'f g6 mt8 fw' },
      el('button', {
        class: S.mode === 'claim' ? 'btn btn-sm btn-gold' : 'btn btn-sm',
        onclick: () => { S.mode = S.mode === 'claim' ? 'inspect' : 'claim'; render() },
      }, S.mode === 'claim' ? '⬢ 圈地中' : '⬢ 开始圈地'),
      S.claimDraft.size
        ? el('button', {
            class: 'btn btn-sm',
            onclick: () => { S.claimDraft.clear(); render() },
          }, '清空 (' + S.claimDraft.size + ')')
        : null,
    ),
  ))

  if (S.claimDraft.size) {
    box.append(el('div', { class: 'p12', style: 'border-top:2px solid var(--line)' },
      el('div', { class: 's10 kicker' }, '草案 ' + S.claimDraft.size + ' 格'),
      el('div', { class: 's11 tm mt4' }, [...S.claimDraft].join('  ')),
      errs.length
        ? el('div', { class: 'mt8' },
            errs.map(e => el('div', { class: 's10', style: 'color:var(--coral)' }, '✕ ' + e)))
        : el('div', { class: 's10 mt8', style: 'color:var(--teal)' }, '✓ 校验通过，可提交'),
      el('button', {
        class: 'btn btn-sm btn-primary mt8', disabled: errs.length > 0,
        onclick: () => {
          S.queue.unshift({
            id: 'q' + S.queue.length + '-claim', kind: 'claim',
            scope: 'territory', origin: 'human',
            nationId: nid, title: `认领 ${S.claimDraft.size} 格领土`,
            detail: [...S.claimDraft].join(' '),
            payload: { cells: [...S.claimDraft] },
            author: role().user, at: '刚刚',
          })
          S.claimDraft.clear()
          S.mode = 'inspect'
          toast('领土申请已提交，待管理员裁决')
          render()
        },
      }, '提交领土申请'),
      el('div', { class: 's10 tm mt6' }, '⚖ 领土变更一律由管理员裁决'),
    ))
  }

  return box
}

// ============================================================
// 格子详情
// ============================================================

function cellPanel() {
  if (!S.selectedCell) return null
  const cell = S.cells.get(S.selectedCell)
  if (!cell) return null
  const t = TERRAIN[cell.terrain]
  const n = cell.owner ? byId(cell.owner) : null
  const ct = contestedAt.get(S.selectedCell)
  const lms = S.landmarks.filter(l => key(l.col, l.row) === S.selectedCell)

  return el('section', { class: 'panel' },
    sub('格 ' + S.selectedCell, t.name),
    el('div', { class: 'p12 f fw g6 ai' },
      el('span', { class: 'tag' }, t.icon + ' ' + t.name),
      el('span', { class: 'tag' }, '资源 ' + t.res),
      el('span', { class: 'tag' }, '高度 ' + t.height),
      n ? el('span', { class: 'tag', style: `border-color:${n.color};color:${n.color}` }, n.flag + ' ' + n.name)
        : el('span', { class: 'tag' }, '⬡ 无主'),
      ct ? el('span', { class: 'tag tag-hot' }, '⚠ 争议中') : null,
    ),
    lms.length
      ? el('div', { class: 'p12', style: 'border-top:2px solid var(--line)' },
          lms.map(l => el('div', { class: 'f g6 ai' },
            el('span', { class: l.origin === 'ai' ? 'tag tag-ai' : 'tag tag-human' },
              l.origin === 'ai' ? '✦AI' : '✎人'),
            el('span', { class: 's11 ti f1' }, l.name),
            l.status === 'pending'
              ? el('span', { class: 'tag tag-pending' }, '待审')
              : el('span', { class: 'tag tag-ok' }, '✓'),
          )))
      : null,
  )
}

// ============================================================
// 排行榜
// ============================================================

function leaderboard() {
  const box = el('section', { class: 'panel' })
  box.append(sub('疆域与 GDP', '点击切换国家'))
  const sorted = [...NATIONS].sort((a, b) => b.gdp - a.gdp)
  const max = Math.max(...sorted.map(n => n.gdp), 1)

  sorted.forEach((n, i) => {
    const terr = territoryOf(n.id).length
    const sel = n.id === S.selected
    box.append(el('button', {
      class: 'row', style: `width:100%;text-align:left;${sel ? 'background:var(--panel-2)' : ''}`,
      onclick: () => { S.selected = n.id; S.selectedCell = null; render() },
    },
      el('span', { class: 's11 mono-num tm', style: 'width:16px' },
        n.status === 'pending' ? '–' : String(i + 1)),
      el('span', { style: 'font-size:15px' }, n.flag),
      el('div', { class: 'f1' },
        el('div', { class: 's12 ti b' }, n.name),
        el('div', { class: 'bar-track mt4' },
          el('div', { class: 'bar-fill', style: `width:${n.gdp / max * 100}%;background:${n.color}` })),
      ),
      el('div', { style: 'text-align:right' },
        el('div', { class: 's11 mono-num ti' }, fmt(n.gdp)),
        el('div', { class: 's10 tm mono-num' }, terr + ' 格'),
      ),
    ))
  })
  return box
}

// ============================================================
// 顶栏
// ============================================================

function topbar() {
  const bar = el('div', { class: 'topbar' },
    el('div', { class: 'logo-cube' }, '⬢'),
    el('div', {},
      el('div', { class: 's12 b ti' }, 'GBN 世界地图'),
      el('div', { class: 's10 tm' }, '疆域 · 资源 · AI 营造'),
    ),
  )

  const rs = el('div', { class: 'f g6 ai fw', style: 'margin-left:auto' })
  rs.append(el('span', { class: 'kicker' }, '身份'))
  Object.values(ROLES).forEach(r => {
    rs.append(el('button', {
      class: 'chip', 'aria-pressed': String(S.role === r.key),
      onclick: () => {
        S.role = r.key
        S.claimDraft.clear()
        S.mode = 'inspect'
        if (r.nationId) S.selected = r.nationId
        render()
      },
    }, r.label))
  })
  bar.append(rs)
  return bar
}

// ============================================================
// 主渲染
// ============================================================

function render() {
  const root = document.getElementById('root')
  const scroll = window.scrollY
  root.replaceChildren()

  root.append(topbar())

  const wrap = el('div', { class: 'wrap' })

  // 身份条
  const r = role()
  wrap.append(el('div', {
    class: 'panel-flat f g8 ai fw p12',
    style: 'margin:16px 0;border-left:4px solid var(--gold)',
  },
    el('div', { class: 'avatar' }, r.avatar),
    el('div', { class: 'f1' },
      el('div', { class: 's12 b ti' }, r.user + ' · ' + r.title),
      el('div', { class: 's10 tm' }, r.hint),
    ),
    el('div', { class: 'f g4 fw' },
      el('span', { class: r.can.submit ? 'tag tag-ok' : 'tag' }, '提交'),
      el('span', { class: r.can.approveDomestic ? 'tag tag-ok' : 'tag' }, '内政核准'),
      el('span', { class: r.can.approveTerritory ? 'tag tag-ok' : 'tag' }, '领土裁决'),
    ),
  ))

  const grid = el('div', { class: 'grid-main' })

  // 左：地图
  const left = el('div', { class: 'stack' })
  const mapBox = el('section', { class: 'panel' })
  mapBox.append(el('div', { class: 'bar' },
    el('span', { class: 'kicker' }, '世界地图'),
    el('span', { class: 's10 tm' },
      `${MAP_W}×${MAP_H} 六角网格 · ${S.cells.size} 陆地格`),
    el('span', { class: 's10 tm', style: 'margin-left:auto' },
      S.mode === 'claim' ? '⬢ 圈地模式' : '点击查看'),
  ))
  mapBox.append(el('div', { class: 'map-stage' }, renderMap()))

  // 图层切换
  const tools = el('div', { class: 'map-tools' })
  tools.append(el('span', { class: 'kicker' }, '图层'))
  ;[['owner', '归属'], ['terrain', '地形'], ['resource', '资源']].forEach(([k, l]) => {
    tools.append(el('button', {
      class: 'chip', 'aria-pressed': String(S.layer === k),
      onclick: () => { S.layer = k; render() },
    }, l))
  })
  tools.append(el('button', {
    class: 'chip', 'aria-pressed': String(S.showDrafts),
    style: 'margin-left:auto',
    onclick: () => { S.showDrafts = !S.showDrafts; render() },
  }, '✦ 显示 AI 草案'))
  mapBox.append(tools)

  // 图例
  const lg = el('div', { class: 'legend' })
  if (S.layer === 'owner') {
    NATIONS.forEach(n => lg.append(el('span', {},
      el('i', { class: 'sw', style: `background:${n.color}` }),
      el('b', {}, n.name))))
  } else if (S.layer === 'terrain') {
    Object.values(TERRAIN).forEach(t => lg.append(el('span', {},
      el('b', {}, t.icon + ' ' + t.name), ' h' + t.height)))
  } else {
    const rc = { 耗材: '#8b93a5', 木材: '#3ddc6b', 矿石: '#c46bff', 港口: '#2bd9f0', 冷凝: '#4a8dff' }
    RESOURCE_ORDER.forEach(k => lg.append(el('span', {},
      el('i', { class: 'sw', style: `background:${rc[k]}` }), el('b', {}, k))))
  }
  lg.append(el('span', {}, el('b', { style: 'color:var(--coral)' }, '⚠ 虚线红'), ' 争议格'))
  lg.append(el('span', {}, el('b', { style: 'color:var(--violet)' }, '✦ 紫'), ' AI 草案'))
  mapBox.append(lg)

  left.append(mapBox)
  const cp = cellPanel()
  if (cp) left.append(cp)
  left.append(leaderboard())

  // 右：详情 + 工坊 + 队列
  const right = el('div', { class: 'stack' })
  right.append(nationPanel())
  right.append(claimPanel())
  right.append(aiWorkshop())
  right.append(reviewQueue())

  grid.append(left, right)
  wrap.append(grid)
  root.append(wrap)

  window.scrollTo(0, scroll)
}

render()
