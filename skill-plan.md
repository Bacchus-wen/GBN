# Skill Plan · GBN 官方活动互动页再开发

Generated: 2026-08-18

---

## Task Summary

在已有 demo 基础上，为 MakerWorld 社区 GBN 开发 Tripo 官方活动页：世界地图、建国/加入、
打印耗材→GDP 经济系统、GDP→Tripo 点数、国家展览馆、战报榜单与每周主题事件。难点不在渲染，
而在三处矛盾：运营口径（展馆优先、回避领土争议）与社区呼声（3D 地图最热）冲突；原 demo 只有
构建产物无源码；真实数据（MW 登录、耗材、点数发放、持久化）全部未打通。产出为一份可执行的
再开发路线与分阶段实施方案。

---

## 现状资产盘点（再开发的起点）

| 资产 | 内容 | 可复用度 |
|---|---|---|
| `activity/` | 原 demo，React+Tailwind 构建产物：世界地图/国家馆/GDP 榜/战报/每周任务/Tripo 船坞/身份弹窗 | 产品形态最完整，但**无源码**，只能逆向或重写 |
| `timeline/data.json` | 444 帖、85 用户、7 阶段、hotPosts/topUsers/themeRows | **唯一真实数据**，可直接喂 World Pulse / 大事件 / 种子国家 |
| `activity-v2/` | 2D SVG 六角地图原型（原生 JS） | 已被 web/ 取代，留作对照 |
| `shared/` | 六角几何、邻接、边界线段、领土校验、22 项 vitest | **工程质量最高**，与 UI 解耦，值得留 |
| `web/` | three.js 3D 六角地图 + 6 面板（圈地/AI 工坊/审核队列） | 渲染层可留；**玩法层与运营口径冲突，需重估** |
| `server/` | Hono，仅 Tripo 代理，无库、无账号、无持久化 | 骨架可留，能力缺 80% |

---

## 方向风险（对上一轮 HANDOFF 的批判性复核）

1. **领土玩法与运营口径相反。** idea.md 运营段明确写「地图形式容易引发用户关于领土的争议，
   长线运营以世博馆形式呈现」。上一轮却把「圈地 + 争议格 + 管理员裁决」做成核心链路，
   等于把运营想规避的风险做成了主功能。
2. **AI 被抬成核心。** 社区反馈原文：「AI 不应作为核心卖点」。上一轮的 AI 草案池 + 三级审核
   是页面上最重的交互，定位需要降级为辅助工具。
3. **ASCII 地图 authoring 与「建国即上图」互斥。** `data.ts` 里 16×10 手写字符图无法支撑
   运行时用户建国自动落地；这不是优点而是架构约束，需要换成数据驱动的领地分配。
4. **阻塞项判断偏了。** HANDOFF 称 Tripo key 是「唯一阻塞项」。真正的阻塞是 MW 账号打通、
   耗材数据源、点数发放合规与后端持久化 —— key 只是其中最小的一个。
5. **范围回退。** 新 `web/` 只覆盖地图，原 demo 已有的国家馆/任务/战报/入驻引导在新代码里
   全部缺失，等于用一个更窄的原型替换了更完整的原型。
6. **新手门槛反向。** 社区要「简单/高级模式」，当前页面是 6 面板 + 图层 + 圈地 + 审核队列。
7. **Benchy 元素仍缺。** 地标只是占位方块，社区最在意的品牌辨识度没有推进。

---

## Top 9 Skills

| Rank | Skill | Fit | Description | Value for This Task |
|------|-------|-----|-------------|---------------------|
| 1 | `brainstorming` | ★★★★★ | 实现前探索意图、需求与设计 | 先解掉「地图为核 vs 展馆为核」「领土 PK 要不要」两个方向级冲突，否则后续全是返工 |
| 2 | `writing-plans` | ★★★★★ | 撰写结构化实施方案 | 跨端 + 外部依赖（MW/Tripo）+ 分期上线，需要带里程碑与依赖前置条件的方案 |
| 3 | `clone-website` | ★★★★ | 逆向克隆网站，提取资产/CSS/内容 | `activity/` 只有 bundle，用它把 demo 的完整活动页复原成可再开发源码，避免重画 UI |
| 4 | `frontend-design-2` | ★★★★ | 生产级前端界面 | 官方 Feature 页要 Benchy 品牌感 + 低新手门槛，直接对应社区两条负面反馈 |
| 5 | `test-driven-development` | ★★★★ | TDD 工作流 | GDP 结算、耗材换算、点数发放是「等价于钱」的规则，必须先有测试再有实现 |
| 6 | `executing-plans` | ★★★★ | 带检查点执行既定方案 | 方案定稿后分阶段落地，每阶段留复核点，防止再次跑偏 |
| 7 | `agent-reach` | ★★★ | 各平台内容检索 | 核对 MakerWorld 真实国家/事件与 mock 的差距；查 MW 开放能力与 Tripo OpenAPI 文档 |
| 8 | `webapp-testing` | ★★★ | Web 应用功能测试 | 3D 交互、入驻引导、兑换流程需真实浏览器验证；上一轮截图验证曾失败 |
| 9 | `systematic-debugging` | ★★★ | 结构化调试 | Tripo key/代理/网络这类误判成本极高的问题（上一轮已踩过一次） |

---

## Recommended Approaches

### Approach A · 展馆优先（运营口径）
> Best for: 一个月活动要按期上线，以「可落地、不引战」为第一优先级。

1. 用 `brainstorming` 锁定范围：地图降级为只读展示层，砍掉圈地/争议/裁决链路
2. 用 `clone-website` 从 `activity/` bundle 复原国家馆 + 任务 + 战报的源码骨架
3. 用 `test-driven-development` 先写死经济规则：耗材→GDP→Tripo 点数的换算与发放
4. 用 `frontend-design-2` 重做入驻引导（加入/无国籍/建国）与 Benchy 视觉
5. 用 `webapp-testing` 跑通首登→加入→上传→计入 GDP→兑换 全链路

### Approach B · 地图为核（社区口径）
> Best for: 押注社区讨论度最高的功能做差异化，接受运营需另行处理领土争议。

1. 用 `brainstorming` 明确边界：地图只做归属与展示，不做玩家划界，争议交人工
2. 复用 `shared/` 几何算法，把 ASCII authoring 换成数据驱动的建国自动落地
3. 用 `frontend-design-2` 把地标从占位方块换成 Benchy 化模型与国旗/舰队
4. 用 `writing-plans` 规划地图→国家馆的下钻路径，把展馆挂在地图之下
5. 用 `webapp-testing` + `systematic-debugging` 验证 3D 性能与移动端可用性

### Approach C · 数据底座先行
> Best for: 认为最大风险是外部接口而非界面，先把真数据闭环打通再谈体验。

1. 用 `agent-reach` 摸清 MW 账号/打印数据的可得性与 Tripo OpenAPI 的点数发放能力
2. 用 `writing-plans` 定义数据契约：用户、国家、成员关系、GDP 流水、点数账本
3. 用 `test-driven-development` 实现服务端账本与幂等发放，替换全部 mock
4. 前端沿用现有 demo 形态最小改造接真数据，界面重做放到最后
5. 用 `verification-before-completion` 对账：耗材、GDP、点数三方数据一致性
