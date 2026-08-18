// 领土认领。社区反馈的「玩家绘制国家边界」入口。
// 领土变更一律进管理员队列 —— 领袖也不能自批。迁移自 activity-v2/app.js:672。
import { nationById, validateClaim } from '@gbn/shared'
import { roleOf, type Action, type AppState } from '../state/store'
import { SubHeader } from './bits'

export function ClaimPanel({ state, dispatch }: {
  state: AppState
  dispatch: (a: Action) => void
}) {
  const role = roleOf(state)
  const nid = role.nationId

  if (!nid) {
    return (
      <section className="panel">
        <SubHeader title="领土认领" note="无本国" />
        <div className="p14 s11 tm">管理员不持有领土。切换身份以认领。</div>
      </section>
    )
  }

  const errs = validateClaim(state.cells, state.draft, nid)
  const claiming = state.mode === 'claim'

  const submit = () => {
    dispatch({
      type: 'submitQueue',
      item: {
        id: `q${Date.now()}-claim`,
        kind: 'claim', scope: 'territory', origin: 'human',
        nationId: nid,
        title: `认领 ${state.draft.size} 格领土`,
        detail: [...state.draft].join(' '),
        rationale: '',
        payload: { cells: [...state.draft] },
        author: role.user,
        at: '刚刚',
      },
    })
    dispatch({ type: 'setMode', mode: 'inspect' })
    dispatch({ type: 'toast', msg: '领土申请已提交，待管理员裁决' })
  }

  return (
    <section className="panel">
      <SubHeader title="领土认领" note={nationById(nid)?.name} />

      <div className="p12">
        <p className="s11 tm">
          {claiming
            ? '点击地图上的格子圈地。必须与本国领土相邻。'
            : '开启「圈地」模式后可在地图上选格。'}
        </p>
        <div className="f g6 mt8 fw">
          <button
            className={claiming ? 'btn btn-sm btn-gold' : 'btn btn-sm'}
            onClick={() => dispatch({ type: 'setMode', mode: claiming ? 'inspect' : 'claim' })}
          >
            {claiming ? '⬢ 圈地中' : '⬢ 开始圈地'}
          </button>
          {state.draft.size > 0 && (
            <button className="btn btn-sm" onClick={() => dispatch({ type: 'clearDraft' })}>
              清空 ({state.draft.size})
            </button>
          )}
        </div>
      </div>

      {state.draft.size > 0 && (
        <div className="p12" style={{ borderTop: '2px solid var(--line)' }}>
          <div className="s10 kicker">草案 {state.draft.size} 格</div>
          <div className="s11 tm mt4">{[...state.draft].join('  ')}</div>

          {errs.length > 0 ? (
            <div className="mt8">
              {errs.map((e, i) => (
                <div key={i} className="s10" style={{ color: 'var(--coral)' }}>✕ {e}</div>
              ))}
            </div>
          ) : (
            <div className="s10 mt8" style={{ color: 'var(--teal)' }}>✓ 校验通过，可提交</div>
          )}

          <button
            className="btn btn-sm btn-primary mt8"
            disabled={errs.length > 0}
            onClick={submit}
          >
            提交领土申请
          </button>
          <div className="s10 tm mt6">⚖ 领土变更一律由管理员裁决</div>
        </div>
      )}
    </section>
  )
}
