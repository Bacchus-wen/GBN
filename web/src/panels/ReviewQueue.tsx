// 审核队列。内政归领袖，领土归管理员 —— 这是三级权限模型的执行点。
// 迁移自 activity-v2/app.js:581。
import { nationById } from '@gbn/shared'
import { roleOf, type Action, type AppState } from '../state/store'
import { SubHeader } from './bits'

export function ReviewQueue({ state, dispatch }: {
  state: AppState
  dispatch: (a: Action) => void
}) {
  const role = roleOf(state)

  return (
    <section className="panel">
      <SubHeader title="审核队列" note={`${state.queue.length} 项待处理`} />

      {state.queue.length === 0 ? (
        <div className="p14 s11 tm">队列为空。</div>
      ) : state.queue.map(q => {
        const canAct = q.scope === 'territory'
          ? role.can.approveTerritory
          : role.can.approveDomestic && (role.nationId === q.nationId || role.can.approveTerritory)
        const n = nationById(q.nationId)

        return (
          <div className="queue-item" key={q.id}>
            <div className="f g6 ai fw">
              <span className={q.origin === 'ai' ? 'tag tag-ai' : 'tag tag-human'}>
                {q.origin === 'ai' ? '✦ AI 草案' : '✎ 原创'}
              </span>
              <span className="tag">{q.scope === 'territory' ? '跨国·领土' : '内政'}</span>
              <span className="s10 tm" style={{ marginLeft: 'auto' }}>{q.at}</span>
            </div>

            <div className="s12 ti b mt6">{q.title}</div>
            <div className="s10 tm mt4">
              {n ? `${n.flag} ${n.name}` : ''} · {q.detail} · 署名 {q.author ?? '—'}
            </div>
            {q.rationale && <div className="rationale">AI 理由：{q.rationale}</div>}

            <div className="f g6 mt8 fw">
              {canAct ? (
                <>
                  <button className="btn btn-sm btn-teal"
                          onClick={() => dispatch({ type: 'decide', id: q.id, approve: true })}>
                    ✓ 核准
                  </button>
                  <button className="btn btn-sm"
                          onClick={() => dispatch({ type: 'decide', id: q.id, approve: false })}>
                    ✕ 驳回
                  </button>
                </>
              ) : (
                <div className="s10 tm">
                  {q.scope === 'territory' ? '⚖ 待社区管理员裁决' : '⚖ 待国家领袖核准'}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </section>
  )
}
