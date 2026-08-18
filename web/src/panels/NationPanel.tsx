// 国家详情。社区反馈明确要求：点击国家看 Leader、成员、GDP、资源。
// 迁移自 activity-v2/app.js:319；疆域/资源/领土争议统计随六角格移除一并下线，
// 待层 2 计划按 owners.bin 重新接线。
import { nationById } from '@gbn/shared'
import type { AppState } from '../state/store'
import { Stat, SubHeader, fmt } from './bits'

export function NationPanel({ state }: { state: AppState }) {
  const n = nationById(state.selectedNation)
  if (!n) return <div className="panel p14 tm">从地图选择一个国家</div>

  return (
    <section className="panel">
      <div className="nat-head">
        <div className="f g12 ai">
          <div className="nat-flag" style={{ background: n.color }}>{n.flag}</div>
          <div className="f1">
            <div className="f g6 ai fw">
              <h2 className="disp s15">{n.name}</h2>
              {n.status === 'pending' && <span className="tag tag-pending">筹备中</span>}
            </div>
            <div className="s11 tm mt4">{n.slogan}</div>
          </div>
        </div>
        <div className="f g8 ai mt12">
          <div className="avatar">{n.leader.avatar}</div>
          <div className="f1">
            <div className="s12 b ti">{n.leader.name}</div>
            <div className="s10 tm">{n.leader.role}</div>
          </div>
          <span className="tag">领袖</span>
        </div>
      </div>

      <div className="stat-grid">
        <Stat k="GDP" v={fmt(n.gdp)} />
        <Stat k="本周" v={'+' + fmt(n.weeklyGdp)} />
        <Stat k="国民" v={n.memberCount} />
      </div>

      <SubHeader title="代表舰队与地标" note="打印核验后计入 GDP" />
      {n.fleet.map(f => (
        <div className="row" key={f.name}>
          <span className="tag">{f.kind}</span>
          <span className="f1 s12 ti">{f.name}</span>
          {f.verified
            ? <span className="tag tag-ok">✓ 已核验</span>
            : <span className="tag tag-pending">待核验</span>}
        </div>
      ))}

      <SubHeader title="国民贡献榜" note={`${n.memberCount} 名国民`} />
      {n.members.map(m => (
        <div className="row" key={m.name}>
          <div className="avatar">{m.avatar}</div>
          <div className="f1">
            <div className="s12 ti b">{m.name}</div>
            <div className="s10 tm">{m.role}</div>
          </div>
          <span className="s11 mono-num" style={{ color: n.color }}>+{fmt(m.gdp)}</span>
        </div>
      ))}

      <SubHeader title="国家纹理与背景" note="AI 可生成草案，署名由人工负责" />
      <div className="p12">
        <div className="f g6 ai">
          <span className="tag">纹理</span>
          <span className="s11 ti">{n.texture}</span>
        </div>
        <p className="s11 tm mt8" style={{ lineHeight: 1.75 }}>
          {n.story || '尚无背景故事。'}
        </p>
      </div>
    </section>
  )
}
