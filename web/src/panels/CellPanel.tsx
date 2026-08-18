// 格子详情。迁移自 activity-v2/app.js:738。
import { CONTESTED, TERRAIN, cellKey, nationById } from '@gbn/shared'
import type { AppState } from '../state/store'
import { SubHeader } from './bits'

export function CellPanel({ state }: { state: AppState }) {
  if (!state.selectedCell) return null
  const cell = state.cells.get(state.selectedCell)
  if (!cell) return null

  const t = TERRAIN[cell.terrain]
  const n = cell.owner ? nationById(cell.owner) : null
  const contested = CONTESTED.find(
    c => cellKey(c.col, c.row) === state.selectedCell &&
         !state.resolvedDisputes.has(state.selectedCell!),
  )
  const lms = state.landmarks.filter(l => cellKey(l.col, l.row) === state.selectedCell)

  return (
    <section className="panel">
      <SubHeader title={`格 ${state.selectedCell}`} note={t.name} />

      <div className="p12 f fw g6 ai">
        <span className="tag">{t.icon} {t.name}</span>
        <span className="tag">资源 {t.res}</span>
        <span className="tag">高度 {t.height}</span>
        {n
          ? <span className="tag" style={{ borderColor: n.color, color: n.color }}>
              {n.flag} {n.name}
            </span>
          : <span className="tag">⬡ 无主</span>}
        {contested && <span className="tag tag-hot">⚠ 争议中</span>}
      </div>

      {lms.length > 0 && (
        <div className="p12" style={{ borderTop: '2px solid var(--line)' }}>
          {lms.map((l, i) => (
            <div className="f g6 ai" key={i}>
              <span className={l.origin === 'ai' ? 'tag tag-ai' : 'tag tag-human'}>
                {l.origin === 'ai' ? '✦AI' : '✎人'}
              </span>
              <span className="s11 ti f1">{l.name}</span>
              {l.status === 'pending'
                ? <span className="tag tag-pending">待审</span>
                : <span className="tag tag-ok">✓</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
