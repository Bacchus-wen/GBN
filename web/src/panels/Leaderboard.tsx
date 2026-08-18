// 疆域与 GDP 排行。迁移自 activity-v2/app.js:775。
import { NATIONS, territoryOf } from '@gbn/shared'
import type { Action, AppState } from '../state/store'
import { SubHeader, fmt } from './bits'

export function Leaderboard({ state, dispatch }: {
  state: AppState
  dispatch: (a: Action) => void
}) {
  const sorted = [...NATIONS].sort((a, b) => b.gdp - a.gdp)
  const max = Math.max(...sorted.map(n => n.gdp), 1)

  return (
    <section className="panel">
      <SubHeader title="疆域与 GDP" note="点击切换国家" />
      {sorted.map((n, i) => {
        const terr = territoryOf(state.cells, n.id).length
        const sel = n.id === state.selectedNation
        return (
          <button
            key={n.id}
            className="row"
            style={{
              width: '100%',
              textAlign: 'left',
              background: sel ? 'var(--panel-2)' : undefined,
            }}
            onClick={() => dispatch({ type: 'selectNation', id: n.id })}
          >
            <span className="s11 mono-num tm" style={{ width: 16 }}>
              {n.status === 'pending' ? '–' : i + 1}
            </span>
            <span style={{ fontSize: 15 }}>{n.flag}</span>
            <div className="f1">
              <div className="s12 ti b">{n.name}</div>
              <div className="bar-track mt4">
                <div className="bar-fill" style={{
                  width: `${n.gdp / max * 100}%`,
                  background: n.color,
                }} />
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="s11 mono-num ti">{fmt(n.gdp)}</div>
              <div className="s10 tm mono-num">{terr} 格</div>
            </div>
          </button>
        )
      })}
    </section>
  )
}
