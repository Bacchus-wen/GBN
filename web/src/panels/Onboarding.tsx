// 初次登入引导。idea.md 规定的用户路径：
//   初次登入弹窗三选一：1 加入国家 | 2 无国籍人士 | 3 成立国家
//   二次登入直接进入活动页
//
// 运营口径明确：「不阻止用户成立新国家，但从活动体验性和执行性考虑，
// 设置条件引导用户加入已有国家，尽量不引导成立新国家。」
// 所以三个选项的视觉权重是有意不对等的——加入国家是主行动，成立国家排在最后
// 并前置展示门槛（国徽 + 简介 + 至少 3 位国民）。

import { NATIONS } from '@gbn/shared'
import { useState } from 'react'
import { fmt } from './bits'

/** 成立新国家所需的最少国民数 */
export const FOUND_MIN_MEMBERS = 3

type Step = 'choose' | 'join' | 'found'

interface Props {
  onJoin: (nationId: string) => void
  onStateless: () => void
  onFound: () => void
}

export function Onboarding({ onJoin, onStateless, onFound }: Props) {
  const [step, setStep] = useState<Step>('choose')

  // 招募中的国家排在前面，把新用户引向最需要人的地方
  const joinable = [...NATIONS]
    .filter(n => n.status === 'active')
    .sort((a, b) => a.memberCount - b.memberCount)

  return (
    <div className="scrim">
      <div className="modal modal-onboard">
        {step === 'choose' && (
          <>
            <h2 className="disp s15">欢迎来到 Great Benchy Nations</h2>
            <p className="s11 tm mt4">
              这是一个由玩家自己写出来的世界。先选一条路——之后随时可以移民。
            </p>

            <button className="btn btn-primary w100 mt12" onClick={() => setStep('join')}>
              加入一个国家
              <span className="s10 tm"> · 最快融入，立刻为国家贡献 GDP</span>
            </button>

            <button className="btn w100 mt4" onClick={onStateless}>
              以无国籍人士身份逛逛
              <span className="s10 tm"> · 随时可以再决定</span>
            </button>

            <button className="btn w100 mt4" onClick={() => setStep('found')}>
              成立新国家
              <span className="s10 tm"> · 需要国徽、简介与 {FOUND_MIN_MEMBERS} 位国民</span>
            </button>
          </>
        )}

        {step === 'join' && (
          <>
            <h2 className="disp s15">选择你的国家</h2>
            <p className="s11 tm mt4">按国民数从少到多排列，人少的国家更需要你。</p>

            <div className="mt12">
              {joinable.map(n => (
                <button key={n.id} className="row" onClick={() => onJoin(n.id)}>
                  <div className="nat-flag" style={{ background: n.color }}>{n.flag}</div>
                  <div className="f1" style={{ textAlign: 'left' }}>
                    <div className="s12 b">{n.name}</div>
                    <div className="s10 tm">{n.slogan}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="s11 mono-num">{n.memberCount} 国民</div>
                    <div className="s10 tm mono-num">GDP {fmt(n.gdp)}</div>
                  </div>
                </button>
              ))}
            </div>

            <button className="btn w100 mt12" onClick={() => setStep('choose')}>返回</button>
          </>
        )}

        {step === 'found' && (
          <>
            <h2 className="disp s15">成立新国家</h2>
            <p className="s11 tm mt4">
              建国是这个世界里最重的一步，门槛也最高。你需要：
            </p>

            <div className="mt12">
              <div className="row"><span className="tag">1</span><span className="s11 f1">设计国徽与国旗</span></div>
              <div className="row"><span className="tag">2</span><span className="s11 f1">写下国名、简介与国家宣言</span></div>
              <div className="row"><span className="tag">3</span><span className="s11 f1">招募至少 {FOUND_MIN_MEMBERS} 位国民联署</span></div>
            </div>

            <p className="s10 tm mt12">
              建国申请会进入社区管理员的审核队列。在此之前，你可以先加入一个国家熟悉玩法。
            </p>

            <button className="btn btn-primary w100 mt12" onClick={onFound}>开始建国流程</button>
            <button className="btn w100 mt4" onClick={() => setStep('choose')}>再想想</button>
          </>
        )}
      </div>
    </div>
  )
}
