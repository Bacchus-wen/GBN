import {
  CONTESTED, MAP_H, MAP_W, NATIONS, RESOURCE_COLOR, RESOURCE_ORDER, ROLES, TERRAIN,
  borderSegments, cellKey,
} from '@gbn/shared'
import type { Cell } from '@gbn/shared'
import { useEffect, useMemo, useReducer } from 'react'
import { HexMap } from './map/HexMap'
import { AiWorkshop } from './panels/AiWorkshop'
import { CellPanel } from './panels/CellPanel'
import { ClaimPanel } from './panels/ClaimPanel'
import { Leaderboard } from './panels/Leaderboard'
import { NationPanel } from './panels/NationPanel'
import { ReviewQueue } from './panels/ReviewQueue'
import { initialState, reducer, roleOf } from './state/store'
import type { LayerKey } from './state/types'

const LAYERS: [LayerKey, string][] = [
  ['owner', '归属'], ['terrain', '地形'], ['resource', '资源'],
]

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const role = roleOf(state)

  // toast 自动消失
  useEffect(() => {
    if (!state.toast) return
    const t = setTimeout(() => dispatch({ type: 'toast', msg: null }), 2200)
    return () => clearTimeout(t)
  }, [state.toast])

  const cellList = useMemo<Cell[]>(() => {
    // 绘制顺序无关（3D 有深度缓冲），但固定顺序让 instanceId 稳定
    return [...state.cells.values()].sort((a, b) => (a.row - b.row) || (a.col - b.col))
  }, [state.cells])

  const borderData = useMemo(
    () => NATIONS.map(n => ({ nation: n, segments: borderSegments(state.cells, n.id) }))
      .filter(x => x.segments.length > 0),
    [state.cells],
  )

  const activeDisputes = useMemo(
    () => CONTESTED.filter(c => !state.resolvedDisputes.has(cellKey(c.col, c.row))),
    [state.resolvedDisputes],
  )

  return (
    <>
      <div className="topbar">
        <div className="logo-cube">⬢</div>
        <div>
          <div className="s12 b ti">GBN 世界地图</div>
          <div className="s10 tm">疆域 · 资源 · AI 营造</div>
        </div>
        <div className="f g6 ai fw" style={{ marginLeft: 'auto' }}>
          <span className="kicker">身份</span>
          {Object.values(ROLES).map(r => (
            <button
              key={r.key}
              className="chip"
              aria-pressed={state.role === r.key}
              onClick={() => {
                dispatch({ type: 'setRole', role: r.key })
                if (r.nationId) dispatch({ type: 'selectNation', id: r.nationId })
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="wrap">
        <div
          className="panel-flat f g8 ai fw p12"
          style={{ margin: '16px 0', borderLeft: '4px solid var(--gold)' }}
        >
          <div className="avatar">{role.avatar}</div>
          <div className="f1">
            <div className="s12 b ti">{role.user} · {role.title}</div>
            <div className="s10 tm">{role.hint}</div>
          </div>
          <div className="f g4 fw">
            <span className={role.can.submit ? 'tag tag-ok' : 'tag'}>提交</span>
            <span className={role.can.approveDomestic ? 'tag tag-ok' : 'tag'}>内政核准</span>
            <span className={role.can.approveTerritory ? 'tag tag-ok' : 'tag'}>领土裁决</span>
          </div>
        </div>

        <div className="grid-main">
          <div className="stack">
            <section className="panel">
              <div className="bar">
                <span className="kicker">世界地图</span>
                <span className="s10 tm">
                  {MAP_W}×{MAP_H} 六角网格 · {state.cells.size} 陆地格
                </span>
                <span className="s10 tm" style={{ marginLeft: 'auto' }}>
                  {state.mode === 'claim' ? '⬢ 圈地模式' : '点击查看 · 拖拽旋转'}
                </span>
              </div>

              <div className="map-stage" style={{ position: 'relative' }}>
                <div className="map-hud">
                  <button
                    className="chip"
                    aria-pressed={state.view === 'board'}
                    onClick={() => dispatch({ type: 'setView', view: 'board' })}
                  >近景</button>
                  <button
                    className="chip"
                    aria-pressed={state.view === 'globe'}
                    onClick={() => dispatch({ type: 'setView', view: 'globe' })}
                  >🌐 远景</button>
                </div>

                <HexMap
                  cells={cellList}
                  cellsMap={state.cells}
                  layer={state.layer}
                  view={state.view}
                  mode={state.mode}
                  selectedNation={state.selectedNation}
                  selectedCell={state.selectedCell}
                  draft={state.draft}
                  landmarks={state.landmarks}
                  showDrafts={state.showDrafts}
                  borderData={borderData}
                  activeDisputes={activeDisputes}
                  onPick={(cell, additive) =>
                    dispatch({ type: 'pickCell', cell, additive })}
                />

                <div className="map-hint">
                  左键拖拽旋转 · 滚轮缩放{state.mode === 'claim' ? ' · 点击格子圈地' : ''}
                </div>
              </div>

              <div className="map-tools">
                <span className="kicker">图层</span>
                {LAYERS.map(([k, l]) => (
                  <button
                    key={k}
                    className="chip"
                    aria-pressed={state.layer === k}
                    onClick={() => dispatch({ type: 'setLayer', layer: k })}
                  >{l}</button>
                ))}
                <button
                  className="chip"
                  aria-pressed={state.showDrafts}
                  style={{ marginLeft: 'auto' }}
                  onClick={() => dispatch({ type: 'toggleDrafts' })}
                >✦ 显示 AI 草案</button>
              </div>

              <div className="legend">
                {state.layer === 'owner' && NATIONS.map(n => (
                  <span key={n.id}>
                    <i className="sw" style={{ background: n.color }} />
                    <b>{n.name}</b>
                  </span>
                ))}
                {state.layer === 'terrain' && Object.values(TERRAIN).map(t => (
                  <span key={t.key}><b>{t.icon} {t.name}</b> h{t.height}</span>
                ))}
                {state.layer === 'resource' && RESOURCE_ORDER.map(k => (
                  <span key={k}>
                    <i className="sw" style={{ background: RESOURCE_COLOR[k] }} />
                    <b>{k}</b>
                  </span>
                ))}
                <span><b style={{ color: 'var(--coral)' }}>⚠ 红环</b> 争议格</span>
                <span><b style={{ color: 'var(--violet)' }}>✦ 紫</b> AI 草案</span>
              </div>
            </section>

            <CellPanel state={state} />
            <Leaderboard state={state} dispatch={dispatch} />
          </div>

          <div className="stack">
            <NationPanel state={state} dispatch={dispatch} />
            <ClaimPanel state={state} dispatch={dispatch} />
            <AiWorkshop state={state} dispatch={dispatch} />
            <ReviewQueue state={state} dispatch={dispatch} />
          </div>
        </div>
      </div>

      {state.toast && <div className="toast">{state.toast}</div>}
    </>
  )
}
