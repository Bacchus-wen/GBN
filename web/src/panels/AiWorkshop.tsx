// AI 营造工坊。硬约束：AI 只出草案，必须人工改写并署名才能提交。
// 迁移自 activity-v2/app.js:460 openDraft，提交按钮的 disabled 逻辑是原则的落地点。
import { TERRAIN, nationById } from '@gbn/shared'
import type { DraftKind } from '@gbn/shared'
import { useState } from 'react'
import { nextAiDraft, roleOf, type Action, type AppState } from '../state/store'
import { TripoPanel } from './TripoPanel'

const KINDS: { k: DraftKind; label: string; needCell: boolean }[] = [
  { k: 'terrain', label: '地形', needCell: true },
  { k: 'landmark', label: '地标', needCell: true },
  { k: 'texture', label: '国家纹理', needCell: false },
  { k: 'story', label: '背景故事', needCell: false },
]

export function AiWorkshop({ state, dispatch }: {
  state: AppState
  dispatch: (a: Action) => void
}) {
  const [open, setOpen] = useState<DraftKind | null>(null)
  const role = roleOf(state)

  const start = (kind: DraftKind, needCell: boolean) => {
    if (!role.nationId) {
      dispatch({ type: 'toast', msg: '管理员无本国，切换为国民或领袖再生成' })
      return
    }
    if (needCell && !state.selectedPlacement) {
      dispatch({ type: 'toast', msg: '请先在地图上点选一个落点' })
      return
    }
    setOpen(kind)
  }

  return (
    <section className="panel">
      <div className="bar">
        <span className="kicker">AI 营造工坊</span>
        <span className="s10 tm" style={{ marginLeft: 'auto' }}>AI 只出草案</span>
      </div>

      <div className="p12">
        <p className="s11 tm">
          AI 提供创意参考，不替代原创。草案必须由人工改写并署名后才能提交；提交后进入审核链。
        </p>
      </div>

      <div className="p12 f fw g6" style={{ borderTop: '2px solid var(--line)' }}>
        {KINDS.map(kd => (
          <button key={kd.k} className="btn btn-sm" onClick={() => start(kd.k, kd.needCell)}>
            ✦ {kd.label}
          </button>
        ))}
      </div>

      <TripoPanel state={state} dispatch={dispatch} />

      <div className="p12 s10 tm" style={{ borderTop: '2px solid var(--line)' }}>
        {role.hint}
      </div>

      {open && (
        <DraftModal
          kind={open}
          state={state}
          dispatch={dispatch}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  )
}

function DraftModal({ kind, state, dispatch, onClose }: {
  kind: DraftKind
  state: AppState
  dispatch: (a: Action) => void
  onClose: () => void
}) {
  const ai = nextAiDraft(state, kind)
  const role = roleOf(state)
  const nation = nationById(role.nationId)
  const needCell = kind === 'terrain' || kind === 'landmark'
  const [text, setText] = useState('')

  const label = { terrain: '地形', landmark: '地标', texture: '国家纹理', story: '背景故事' }[kind]
  const p = state.selectedPlacement
  const placementLabel = p ? `X${p.x.toFixed(1)} Z${p.z.toFixed(1)}` : ''

  // 硬约束：必须改写，且不能与 AI 原文相同
  const trimmed = text.trim()
  const canSubmit = trimmed.length >= 4 && trimmed !== (ai.text ?? '').trim() && (!needCell || !!p)

  const submit = () => {
    if (!canSubmit || !role.nationId) return
    dispatch({ type: 'advanceAi', kind })
    dispatch({
      type: 'submitQueue',
      item: {
        id: `q${Date.now()}-${kind}`,
        kind, scope: 'domestic', origin: 'ai',
        nationId: role.nationId,
        title: trimmed.slice(0, 40),
        detail: needCell && p ? `落点 ${placementLabel}` : (nation?.name ?? ''),
        rationale: ai.rationale,
        author: role.user,
        edited: true,
        at: '刚刚',
        payload: {
          terrain: ai.terrain,
          cell: needCell && p ? `${p.x.toFixed(1)},${p.z.toFixed(1)}` : undefined,
          text: trimmed,
        },
      },
    })
    onClose()
  }

  return (
    <div className="scrim" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="bar">
          <span className="tag tag-ai">✦ AI 草案</span>
          <span className="kicker">{label}</span>
          <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={onClose}>✕</button>
        </div>

        <div className="p14">
          <div className="s10 kicker">AI 提议</div>
          <div className="s15 disp mt4">{ai.label}</div>
          <div className="rationale">理由：{ai.rationale}</div>
          {needCell && p && (
            <div className="s10 tm mt8">
              落点 {placementLabel}
              {ai.terrain && ` → ${TERRAIN[ai.terrain].name}`}
            </div>
          )}
        </div>

        <div className="p14" style={{ borderTop: '2px solid var(--line)' }}>
          <div className="s10 kicker">你的改写 · 署名 {role.user}</div>
          {kind === 'story' && ai.text && (
            <div className="rationale mt6" style={{ borderLeftColor: 'var(--line-hot)' }}>
              AI 原文供参考：{ai.text}
            </div>
          )}
          <div className="mt6">
            <textarea
              rows={kind === 'story' ? 5 : 2}
              className="inset p12"
              style={{ width: '100%', font: 'inherit', color: 'var(--ink)', resize: 'vertical' }}
              placeholder="在此改写为你自己的表述（必填，AI 原文不可直接提交）"
              value={text}
              onChange={e => setText(e.target.value)}
            />
          </div>
          <div className="s10 mt6" style={{ color: 'var(--gold)' }}>
            ⚠ 必须改写后才能提交。这是「AI 提供参考而非替代原创」的硬约束。
          </div>
        </div>

        <div className="p14 f g8" style={{ borderTop: '2px solid var(--line)' }}>
          <button className="btn btn-primary" disabled={!canSubmit} onClick={submit}>
            提交审核
          </button>
          <button className="btn" onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  )
}
