// 国家展览馆。idea.md 把线上世博馆定为长线运营的核心形态：
// 「地图形式容易引发用户关于领土的争议，从可落地的长线运营角度：
//   每个国家用作品说话，GBN 将以线上世博馆的形式呈现各个国家的 3D 作品。」
//
// 两条社区规范在这里落地：AI 生成的展品必须单独标识（AI Flair）；
// 展品可下载 3mf，鼓励有能力的用户优化后上传到 MakerWorld。

import { WEEKLY_THEME, exhibitsOf, nationById } from '@gbn/shared'
import type { Exhibit } from '@gbn/shared'
import type { Action, AppState } from '../state/store'
import { SubHeader, fmt } from './bits'

function ExhibitRow({ e, onDownload }: { e: Exhibit; onDownload: (e: Exhibit) => void }) {
  return (
    <div className="row">
      <div className="avatar">{e.authorAvatar}</div>

      <div className="f1">
        <div className="f g6 ai fw">
          <span className="s12 b">{e.title}</span>
          {e.origin === 'ai'
            ? <span className="tag tag-ai">AI 生成</span>
            : <span className="tag tag-human">原创</span>}
          {e.theme && <span className="tag tag-hot">{e.theme}</span>}
        </div>
        <div className="s10 tm mt4">
          {e.author} · 打印 {fmt(e.prints)} · 收藏 {fmt(e.likes)}
        </div>
      </div>

      <button
        className="btn btn-sm"
        disabled={!e.hasModel}
        onClick={() => onDownload(e)}
      >
        {e.hasModel ? '下载 3mf' : '暂无模型'}
      </button>
    </div>
  )
}

export function Pavilion({ state, dispatch }: { state: AppState; dispatch: (a: Action) => void }) {
  const nation = nationById(state.selectedNation)

  if (!nation) {
    return (
      <section className="panel">
        <SubHeader title="国家展览馆" />
        <div className="p14 s11 tm">从地图上点选一个国家，查看它的展馆</div>
      </section>
    )
  }

  const items = exhibitsOf(nation.id)
  const totalPrints = items.reduce((sum, e) => sum + e.prints, 0)
  const aiCount = items.filter(e => e.origin === 'ai').length

  return (
    <section className="panel">
      <SubHeader
        title={`${nation.name} 展览馆`}
        note={`本周主题 · ${WEEKLY_THEME}`}
      />

      {items.length === 0
        ? <div className="p14 s11 tm">该国还没有展品。用 Tripo 生成第一件，为国家开馆。</div>
        : (
          <>
            <div className="stat-grid">
              <div className="stat">
                <div className="stat-k">展品</div>
                <div className="stat-v">{items.length}</div>
              </div>
              <div className="stat">
                <div className="stat-k">累计打印</div>
                <div className="stat-v">{fmt(totalPrints)}</div>
              </div>
            </div>

            {items.map(e => (
              <ExhibitRow
                key={e.id}
                e={e}
                onDownload={ex => dispatch({
                  type: 'toast',
                  msg: `已开始下载「${ex.title}」的 3mf，优化后欢迎上传到 MakerWorld`,
                })}
              />
            ))}

            <div className="p12 s10 tm">
              {aiCount} / {items.length} 件为 AI 生成，均已标注。
              打印记录计入 {nation.name} 的 GDP。
            </div>
          </>
          )}
    </section>
  )
}
