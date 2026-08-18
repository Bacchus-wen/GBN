// 落点详情：点击连续地形后显示坐标 / 高度 / 坡度。
import type { AppState } from '../state/store'
import { SubHeader } from './bits'

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

  return (
    <section className="panel">
      <SubHeader title="落点信息" note={`X ${p.x.toFixed(1)} · Z ${p.z.toFixed(1)}`} />

      <div className="p12">
        <div className="s10 tm">坐标 X {p.x.toFixed(1)} · Z {p.z.toFixed(1)}</div>
        <div className="s10 tm">高度 {p.y.toFixed(2)}</div>
        <div className="s10 tm">坡度 {(Math.acos(p.ny) * 180 / Math.PI).toFixed(1)}°</div>
      </div>
    </section>
  )
}
