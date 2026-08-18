// 国家详情。社区反馈明确要求：点击国家看 Leader、成员、GDP、资源。
// 迁移自 activity-v2/app.js:319。
import {
  CONTESTED, RESOURCE_ORDER, contestedOf, nationById, resourcesOf, territoryOf,
} from '@gbn/shared'
import { roleOf, type Action, type AppState } from '../state/store'
import { Stat, SubHeader, fmt } from './bits'

export function NationPanel({ state, dispatch }: {
  state: AppState
  dispatch: (a: Action) => void
}) {
  const n = nationById(state.selectedNation)
  if (!n) return <div className="panel p14 tm">从地图选择一个国家</div>

  const terr = territoryOf(state.cells, n.id)
  const res = resourcesOf(state.cells, n.id)
  const disputes = contestedOf(CONTESTED, n.id)
  const maxRes = Math.max(1, ...Object.values(res))
  const role = roleOf(state)

  return (
    <section className="panel">
      <div className="nat-head">
        <div className="f g12 ai">
          <div className="nat-flag" style={{ background: n.color }}>{n.flag}</div>
          <div className="f1">
            <div className="f g6 ai fw">
              <h2 className="disp s15">{n.name}</h2>
              {n.status === 'pending' && <span className="tag tag-pending">筹备中</span>}
            </div>
            <div className="s11 tm mt4">{n.slogan}</div>
          </div>
        </div>
        <div className="f g8 ai mt12">
          <div className="avatar">{n.leader.avatar}</div>
          <div className="f1">
            <div className="s12 b ti">{n.leader.name}</div>
            <div className="s10 tm">{n.leader.role}</div>
          </div>
          <span className="tag">领袖</span>
        </div>
      </div>

      <div className="stat-grid">
        <Stat k="GDP" v={fmt(n.gdp)} />
        <Stat k="本周" v={'+' + fmt(n.weeklyGdp)} />
        <Stat k="国民" v={n.memberCount} />
        <Stat k="疆域" v={terr.length + ' 格'} />
      </div>

      <SubHeader title="资源禀赋" note={`按 ${terr.length} 格地形统计`} />
      {RESOURCE_ORDER.map(k => (
        <div className="res-row" key={k}>
          <span className="res-name">{k}</span>
          <div className="bar-track f1">
            <div className="bar-fill" style={{
              width: `${res[k] / maxRes * 100}%`,
              background: n.color,
            }} />
          </div>
          <span className="s11 mono-num tm" style={{ width: 18, textAlign: 'right' }}>
            {res[k]}
          </span>
        </div>
      ))}

      {disputes.length > 0 && (
        <>
          <SubHeader title="领土争议" note="须管理员裁决" />
          {disputes.map(d => {
            const otherId = d.claimants.find(x => x !== n.id)!
            const other = nationById(otherId)
            return (
              <div key={`${d.col},${d.row}`} className="p12"
                   style={{ borderBottom: '1px solid var(--line)' }}>
                <div className="f g6 ai fw">
                  <span className="tag tag-hot">格 {d.col},{d.row}</span>
                  <span className="s11 ti b">vs {other?.name}</span>
                  <span className="s10 tm">{d.since}</span>
                </div>
                <div className="s11 tm mt6">{d.note}</div>
                {role.can.approveTerritory ? (
                  <div className="f g6 mt8">
                    <button className="btn btn-sm btn-teal" onClick={() => dispatch({
                      type: 'resolveDispute', col: d.col, row: d.row, winner: n.id,
                    })}>判归 {n.name}</button>
                    <button className="btn btn-sm" onClick={() => dispatch({
                      type: 'resolveDispute', col: d.col, row: d.row, winner: otherId,
                    })}>判归 {other?.name}</button>
                  </div>
                ) : (
                  <div className="s10 tm mt6">⚖ 仅社区管理员可裁决</div>
                )}
              </div>
            )
          })}
        </>
      )}

      <SubHeader title="代表舰队与地标" note="打印核验后计入 GDP" />
      {n.fleet.map(f => (
        <div className="row" key={f.name}>
          <span className="tag">{f.kind}</span>
          <span className="f1 s12 ti">{f.name}</span>
          {f.verified
            ? <span className="tag tag-ok">✓ 已核验</span>
            : <span className="tag tag-pending">待核验</span>}
        </div>
      ))}

      <SubHeader title="国民贡献榜" note={`${n.memberCount} 名国民`} />
      {n.members.map(m => (
        <div className="row" key={m.name}>
          <div className="avatar">{m.avatar}</div>
          <div className="f1">
            <div className="s12 ti b">{m.name}</div>
            <div className="s10 tm">{m.role}</div>
          </div>
          <span className="s11 mono-num" style={{ color: n.color }}>+{fmt(m.gdp)}</span>
        </div>
      ))}

      <SubHeader title="国家纹理与背景" note="AI 可生成草案，署名由人工负责" />
      <div className="p12">
        <div className="f g6 ai">
          <span className="tag">纹理</span>
          <span className="s11 ti">{n.texture}</span>
        </div>
        <p className="s11 tm mt8" style={{ lineHeight: 1.75 }}>
          {n.story || '尚无背景故事。'}
        </p>
      </div>
    </section>
  )
}
