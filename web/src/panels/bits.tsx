// 小构件。对应 activity-v2/app.js 的 stat() / sub() / fmt()。

export const fmt = (v: number): string =>
  v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v)

export function Stat({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="stat">
      <div className="stat-k">{k}</div>
      <div className="stat-v mono-num">{v}</div>
    </div>
  )
}

/** 段落标题条。复用 .bar 的斜纹样式，与 2D 版 sub() 一致。 */
export function SubHeader({ title, note }: { title: string; note?: string }) {
  return (
    <div className="bar">
      <span className="kicker">{title}</span>
      {note && <span className="s10 tm" style={{ marginLeft: 'auto' }}>{note}</span>}
    </div>
  )
}
