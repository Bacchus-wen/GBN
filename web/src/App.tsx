import { NATIONS, RESOURCE_COLOR, RESOURCE_ORDER, ROLES, TERRAIN } from '@gbn/shared'
import { placementAt } from '@gbn/shared/world'
import { useEffect, useReducer, useState } from 'react'
import { AiWorkshop } from './panels/AiWorkshop'
import { CellPanel } from './panels/CellPanel'
import { Leaderboard } from './panels/Leaderboard'
import { NationPanel } from './panels/NationPanel'
import { ReviewQueue } from './panels/ReviewQueue'
import { initialState, reducer, roleOf } from './state/store'
import type { LayerKey } from './state/types'
import { loadWorld } from './world/loadWorld'
import type { LoadedWorld } from './world/loadWorld'
import { WorldCanvas } from './world/WorldCanvas'

const LAYERS: [LayerKey, string][] = [
  ['owner', '归属'], ['terrain', '地形'], ['resource', '资源'],
]

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const role = roleOf(state)

  const [world, setWorld] = useState<LoadedWorld | null>(null)
  useEffect(() => { loadWorld().then(setWorld).catch(() => setWorld(null)) }, [])

  // toast 自动消失
  useEffect(() => {
    if (!state.toast) return
    const t = setTimeout(() => dispatch({ type: 'toast', msg: null }), 2200)
    return () => clearTimeout(t)
  }, [state.toast])

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
                  {world ? `${world.spec.sizeX}×${world.spec.sizeZ} 连续地形` : '加载中…'}
                </span>
                <span className="s10 tm" style={{ marginLeft: 'auto' }}>
                  点击查看 · 拖拽旋转
                </span>
              </div>

              <div className="map-stage" style={{ position: 'relative' }}>
                {world
                  ? (
                    <WorldCanvas
                      world={world}
                      onPick={pt => dispatch({
                        type: 'pickPlacement',
                        placement: placementAt(world.hf, pt.x, pt.z, world.spec.meshRes),
                      })}
                    />
                    )
                  : <div className="s10 tm" style={{ padding: 24 }}>加载世界…</div>}
                <div className="map-hint">左键拖拽旋转 · 滚轮缩放 · 点击地形选点</div>
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
              </div>
            </section>

            <CellPanel state={state} />
            <Leaderboard state={state} dispatch={dispatch} />
          </div>

          <div className="stack">
            <NationPanel state={state} />
            <AiWorkshop state={state} dispatch={dispatch} />
            <ReviewQueue state={state} dispatch={dispatch} />
          </div>
        </div>
      </div>

      {state.toast && <div className="toast">{state.toast}</div>}
    </>
  )
}
