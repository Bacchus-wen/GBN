// 落点详情：点击连续地形后显示归属、地貌、产出与可建设性。
// 「可建设」这条直接关系到后面能不能在此处安置地标，所以放在最显眼的位置。
import { TERRAIN, nationByGlyph } from '@gbn/shared'
import type { AppState } from '../state/store'
import { SubHeader } from './bits'

/** 超过这个坡度就放不稳东西 */
const MAX_BUILD_SLOPE = 30

export function CellPanel({ state }: { state: AppState }) {
  const p = state.selectedPlacement

  if (!p) {
    return (
      <section className="panel">
        <SubHeader title="落点信息" />
        <div className="p14 s11 tm">点击地形选点</div>
      </section>
    )
  }

  const nation = nationByGlyph(state.selectedOwnerGlyph)
  const terrain = TERRAIN[state.selectedTerrainKey as keyof typeof TERRAIN]
  const slope = (Math.acos(Math.min(1, Math.max(-1, p.ny))) * 180) / Math.PI
  const isSea = state.selectedTerrainKey === '.'
  const buildable = !isSea && slope < MAX_BUILD_SLOPE

  return (
    <section className="panel">
      <SubHeader title="落点信息" note={`X ${p.x.toFixed(1)} · Z ${p.z.toFixed(1)}`} />

      <div className="row jb">
        <span className="s10 tm">归属</span>
        {nation
          ? (
            <span className="s11 b">
              <i className="sw" style={{ background: nation.color }} />
              {nation.flag} {nation.name}
            </span>
            )
          : <span className="s11 tm">{isSea ? '公海' : '无主之地'}</span>}
      </div>

      <div className="row jb">
        <span className="s10 tm">地貌</span>
        <span className="s11">{isSea ? '≈ 海域' : `${terrain?.icon ?? ''} ${terrain?.name ?? '未知'}`}</span>
      </div>

      {!isSea && terrain && (
        <div className="row jb">
          <span className="s10 tm">产出</span>
          <span className="s11">{terrain.res}</span>
        </div>
      )}

      <div className="row jb">
        <span className="s10 tm">海拔 / 坡度</span>
        <span className="s11 mono-num">{p.y.toFixed(1)} · {slope.toFixed(1)}°</span>
      </div>

      <div className="row jb">
        <span className="s10 tm">可建设</span>
        <span className={buildable ? 'tag tag-ok' : 'tag tag-pending'}>
          {buildable ? '可安置地标' : isSea ? '海域' : '坡度过陡'}
        </span>
      </div>
    </section>
  )
}
