// 选中地标的详情。生成完的模型不能只是钉在地图上看不见摸不着——
// 这里提供凑近看、重新摆放、下载三件事。
import { nationById } from '@gbn/shared'
import { roleOf, type Action, type AppState } from '../state/store'
import { SubHeader } from './bits'

export function LandmarkPanel({ state, dispatch }: {
  state: AppState
  dispatch: (a: Action) => void
}) {
  const idx = state.selectedLandmarkIdx
  if (idx == null) return null

  const l = state.landmarks[idx]
  if (!l) return null

  const role = roleOf(state)
  const nation = nationById(l.nationId)
  // 只能挪自己国家的地标，且得有提交权（管理员无本国，不参与摆放）
  const canMove = Boolean(role.can.submit && role.nationId && role.nationId === l.nationId)

  return (
    <section className="panel">
      <SubHeader title="地标" note={nation?.name ?? '—'} />

      <div className="row jb">
        <span className="s12 b">{l.name}</span>
        {l.origin === 'ai'
          ? <span className="tag tag-ai">AI 生成</span>
          : <span className="tag tag-human">原创</span>}
      </div>

      <div className="row jb">
        <span className="s10 tm">作者</span>
        <span className="s11">{l.author}</span>
      </div>

      <div className="row jb">
        <span className="s10 tm">状态</span>
        <span className={l.status === 'approved' ? 'tag tag-ok' : 'tag tag-pending'}>
          {l.status === 'approved' ? '已核验' : '待核准'}
        </span>
      </div>

      <div className="row jb">
        <span className="s10 tm">落点</span>
        <span className="s11 mono-num">
          X {l.placement.x.toFixed(1)} · Z {l.placement.z.toFixed(1)} · 高 {l.placement.y.toFixed(1)}
        </span>
      </div>

      <div className="row jb">
        <span className="s10 tm">模型</span>
        <span className="s11 tm">{l.modelUrl ? 'Tripo 生成' : '程序化占位'}</span>
      </div>

      <div className="p12 f g6 fw">
        {state.draggingLandmark
          ? (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => dispatch({ type: 'setDragging', dragging: false })}
            >
              完成摆放
            </button>
            )
          : (
            <button
              className="btn btn-sm"
              disabled={!canMove}
              title={canMove ? '在地图上拖动它' : '只能移动本国地标'}
              onClick={() => dispatch({ type: 'setDragging', dragging: true })}
            >
              重新摆放
            </button>
            )}

        {l.modelUrl && (
          <a className="btn btn-sm" href={l.modelUrl} download>
            下载模型
          </a>
        )}

        <button
          className="btn btn-sm"
          onClick={() => dispatch({ type: 'selectLandmark', idx: null })}
        >
          取消选中
        </button>
      </div>

      {state.draggingLandmark && (
        <div className="p12 s10" style={{ color: 'var(--gold)', borderTop: '1px solid var(--line)' }}>
          拖动中：在地形上移动指针即可改变位置，高度会自动贴合地面。完成后点「完成摆放」。
        </div>
      )}
    </section>
  )
}
