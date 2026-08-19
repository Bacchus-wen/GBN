// Tripo 3D 生成。国家地标走 text-to-model，产出物先进「草案」态，再走内政审核链。
// 同 AI 文本草案一样的硬约束：prompt 必须人工改写才能提交。
import { nationById } from '@gbn/shared'
import { useEffect, useRef, useState } from 'react'
import {
  createLandmarkTask, ingestAsset, modelUrlOf, pollTask, previewUrlOf, type TripoTask,
} from '../api/tripo'
import { nextAiDraft, roleOf, type Action, type AppState } from '../state/store'

type Phase = 'idle' | 'editing' | 'running' | 'done' | 'error'

export function TripoPanel({ state, dispatch }: {
  state: AppState
  dispatch: (a: Action) => void
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [prompt, setPrompt] = useState('')
  const [task, setTask] = useState<TripoTask | null>(null)
  /** 入库后的稳定本地地址。Tripo 原始 URL 约 24h 过期，不能直接存进数据 */
  const [assetUrl, setAssetUrl] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const stop = useRef<(() => void) | null>(null)

  const role = roleOf(state)
  const nation = nationById(role.nationId)
  const ai = nextAiDraft(state, 'landmark')

  // 卸载时停止轮询
  useEffect(() => () => stop.current?.(), [])

  const suggestion = nation
    ? `${ai.label}，low-poly 体素风格，${nation.texture}，适合 3D 打印的单件结构`
    : ai.label

  const canSubmit = prompt.trim().length >= 8 && prompt.trim() !== suggestion.trim()

  const begin = () => {
    if (!role.nationId) {
      dispatch({ type: 'toast', msg: '管理员无本国，切换为国民或领袖再生成' })
      return
    }
    if (!state.selectedPlacement) {
      dispatch({ type: 'toast', msg: '请先在地图上点选一个落点' })
      return
    }
    setPrompt('')
    setErr(null)
    setPhase('editing')
  }

  const generate = async () => {
    setPhase('running')
    setErr(null)
    const spot = state.selectedPlacement
    if (spot) {
      dispatch({ type: 'setGenerating', generating: { placement: spot, label: prompt.trim() } })
    }
    try {
      const { task_id } = await createLandmarkTask({
        prompt: prompt.trim(),
        seedKey: role.nationId ?? undefined,
      })
      stop.current = pollTask(task_id, {
        onUpdate: t => setTask(t),
        onDone: t => {
          setTask(t)
          if (t.status !== 'success') {
            dispatch({ type: 'setGenerating', generating: null })
            setPhase('error')
            setErr(`生成${t.status === 'failed' ? '失败' : '被取消'}`)
            return
          }
          // 立刻入库。等到核准时再下载就晚了——签名 URL 那时可能已经过期。
          const remote = modelUrlOf(t)
          if (!remote) {
            dispatch({ type: 'setGenerating', generating: null })
            setPhase('error')
            setErr('生成成功但没有返回模型地址')
            return
          }
          ingestAsset({ url: remote, key: t.task_id })
            .then(a => { setAssetUrl(a.url); setPhase('done') })
            .catch(e => {
              dispatch({ type: 'setGenerating', generating: null })
              setErr(`模型入库失败：${e instanceof Error ? e.message : '未知错误'}`)
              setPhase('error')
            })
        },
        onError: e => {
          dispatch({ type: 'setGenerating', generating: null })
          setErr(e.message)
          setPhase('error')
        },
      })
    } catch (e) {
      dispatch({ type: 'setGenerating', generating: null })
      setErr(e instanceof Error ? e.message : '请求失败')
      setPhase('error')
    }
  }

  const submitForReview = () => {
    const p = state.selectedPlacement
    if (!role.nationId || !p) return
    dispatch({ type: 'advanceAi', kind: 'landmark' })
    dispatch({
      type: 'submitQueue',
      item: {
        id: `q${Date.now()}-tripo`,
        kind: 'landmark', scope: 'domestic', origin: 'ai',
        nationId: role.nationId,
        title: prompt.trim().slice(0, 40),
        detail: `落点 X${p.x.toFixed(1)} Z${p.z.toFixed(1)} · Tripo 3D`,
        rationale: `Tripo text-to-model 生成，prompt 由 ${role.user} 改写并署名。`,
        author: role.user,
        edited: true,
        at: '刚刚',
        payload: { placement: p, text: assetUrl ?? undefined },
      },
    })
    setPhase('idle')
    setTask(null)
    setAssetUrl(null)
    dispatch({ type: 'setGenerating', generating: null })
    dispatch({ type: 'toast', msg: '已提交领袖核准' })
  }

  return (
    <div className="p12" style={{ borderTop: '2px solid var(--line)' }}>
      <div className="f ai g8">
        <span className="tag tag-ai">✦ Tripo 3D</span>
        <span className="s10 tm">生成国家地标模型</span>
        {phase === 'idle' && (
          <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={begin}>
            生成地标
          </button>
        )}
      </div>

      {phase === 'editing' && (
        <div className="mt8">
          <div className="rationale">AI 建议 prompt：{suggestion}</div>
          <div className="s10 kicker mt6">你的改写 · 署名 {role.user}</div>
          <textarea
            rows={3}
            className="inset p12 mt4"
            style={{ width: '100%', font: 'inherit', color: 'var(--ink)', resize: 'vertical' }}
            placeholder="改写为你自己的 prompt（必填，不能直接用 AI 原句）"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
          />
          <div className="s10 mt6" style={{ color: 'var(--gold)' }}>
            ⚠ 必须改写后才能生成。生成结果仍需领袖核准才会上地图。
          </div>
          <div className="f g6 mt8">
            <button className="btn btn-sm btn-primary" disabled={!canSubmit} onClick={generate}>
              调用 Tripo 生成
            </button>
            <button className="btn btn-sm" onClick={() => setPhase('idle')}>取消</button>
          </div>
        </div>
      )}

      {phase === 'running' && (
        <div className="mt8">
          <div className="s11">
            正在生成…（{task?.status ?? 'queued'}
            {typeof task?.progress === 'number' ? ` ${task.progress}%` : ''}）
          </div>
          <div className="inset mt6" style={{ height: 6 }}>
            <div style={{
              width: `${task?.progress ?? 5}%`,
              height: '100%',
              background: 'var(--teal)',
              transition: 'width .3s steps(4)',
            }} />
          </div>
          <div className="s10 tm mt6">Tripo 生成通常需要 1–3 分钟，可以先做别的。</div>
        </div>
      )}

      {phase === 'done' && (
        <div className="mt8">
          <div className="f g6 ai fw">
            <span className="tag tag-ok">✓ 生成完成</span>
            {assetUrl && <span className="s10 tm">模型已入库，不受 Tripo 链接过期影响</span>}
          </div>
          {task && previewUrlOf(task) && (
            <img
              src={previewUrlOf(task)}
              alt="Tripo 生成预览"
              className="inset mt6"
              style={{ width: '100%', imageRendering: 'pixelated' }}
            />
          )}
          <div className="f g6 mt8">
            <button
              className="btn btn-sm btn-primary"
              disabled={!state.selectedPlacement}
              onClick={submitForReview}
            >
              提交领袖核准
            </button>
            <button
              className="btn btn-sm"
              onClick={() => {
                setPhase('idle')
                setTask(null)
                setAssetUrl(null)
                dispatch({ type: 'setGenerating', generating: null })
              }}
            >
              丢弃
            </button>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="mt8">
          <div className="tag tag-hot">✕ {err ?? '生成失败'}</div>
          <div className="s10 tm mt6">
            检查 server/.env 里的 TRIPO_API_KEY 是否已配置且余额充足。
          </div>
          <button className="btn btn-sm mt8" onClick={() => setPhase('idle')}>返回</button>
        </div>
      )}
    </div>
  )
}
