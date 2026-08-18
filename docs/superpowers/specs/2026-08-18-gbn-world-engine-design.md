# GBN World Engine · 设计文档

日期：2026-08-18
状态：已确认，待实施

以 WorldClaw 论文（arXiv:2608.05248, Tencent Hunyuan）的方法论重建 GBN 世界地图：
放弃六角格，改为连续地形世界；用 GPT + GPT-Image + Tripo v3 替换论文的
Claude Opus 4.8 + GPT-Image-2 + SAM3/SAM3D + Hunyuan3D。

---

## 1. 背景与决策依据

### 1.1 已否决的两条路

**直接基于 `blendi-remade/fal-worldclaw` 二次开发** —— 否决。三个原因：
仓库无 LICENSE 文件（保留所有权利），法律上不能作为产品基础；它自陈跳过了论文
最核心的放置恢复（改为规划 agent + 确定性求解器）；它的连续高度场架构与当时的
六角格数据结构冲突。可借鉴的是工程小件（GLB 归一化、生成占位体验），不是论文复现。

**按论文完整复刻** —— 否决。论文的 2.3.2 依赖 SAM3D 同时输出 mesh、局部到物体相机
变换 `T_l2c`、重建相机内参 `K_o`，这三个量是 Eq.11 尺度标定与 Eq.13 放置变换的必需
输入。Tripo 只返回 GLB，不返回相机参数 —— 这不是精度差距，是接口里没有这个量。
另外论文实测环境为 4×H20 + Blender 5.1.1 服务端 + 多轮 agent 精修，与多人并发的
活动页在成本和延迟上是数量级错配。论文 Limitations 亦自陈：极度依赖底座模型、
LLM 生成 Blender 代码不稳定、长流程开销随物体数增长。

### 1.2 采纳的路线

取论文方法论，不取其实现。真正迁移三样：

1. **结构化中间表示** —— LLM 只产出可校验的 schema，不直接产出 3D
2. **全局-区域两级** —— 全局定骨架，局部才细化
3. **原型复用 + 实例化** —— 生成一次，实例化多次。这是成本命门

### 1.3 关键洞察：问题结构比论文简单一个量级

论文需要 Eq.10–13 的射线对应恢复位姿，是因为它的地形是连续生成物、物体位置要从
2D 构图图像里反解。GBN 的地形由我们自己烘焙、高度场解析可知，用户落点由一次
raycast 直接得到精确坐标与法线。**放置不需要反解，因此 SAM3 + SAM3D 整段可以删除。**

同理，论文用 GPT-Image-2 生成语义布局图 `I_layout`，是因为世界形状是生成物；
GBN 的世界形状是运营权威数据，现有 `OWNER_MAP` / `TERRAIN_MAP` 两张 ASCII 图
本身就是论文所说的彩色编码 2D 区域划分。

---

## 2. 架构：三层分频

生成时机按频率分三层，各层对应不同角色、不同成本模型。

### 层 1 · 世界地形（离线烘焙 ×1，运营控制）

输入 `shared/src/data.ts` 的 `OWNER_MAP`（归属）与 `TERRAIN_MAP`（地形）两张 16×10
ASCII 图，升采样并高斯软化为 1024² 的区域掩膜 `m_r`（论文 2.2.3 的 boundary
smoothing），再按论文 Eq.6 合成全局高度场：

```
H(x) = Σ_r m_r(x) · [ h_r + Σ_k w_r,k · N_r,k(x) + Σ_j λ_r,j · G_r,j(x) ]
```

- `h_r` 区域基准高程，直接取现有 `TERRAIN` 表的 `height` 字段
  （平原 10 / 森林 13 / 山地 20 / 海岸 5 / 冰原 11 / 礁岩 5 / 火山 24 / 荒漠 9）
- `N_r,k` 分频噪声（simplex），`w_r,k` 为权重
- `G_r,j` 地貌算子：peak / dune / terrace / erosion，`λ_r,j` 为权重

16×10 只定宏观区域，地表细节全部由噪声与地貌算子产生 —— 这正是 Eq.6 的分工，
布局图分辨率粗不构成问题。

**产物**：heightmap、区域掩膜、材质分配表、`world-spec.json`，输出到 `web/public/world/`
作为静态资产随构建发布。
**执行**：`npm run bake:world` 本地 node 脚本，不进运行时。种子固定，输出可复现。

### 层 2 · 国家区域（异步 ×国家数，领袖触发）

领袖在国家页触发「营造国土」，流水线：

1. **GPT 规划 agent**：国家简介 / 口号 → 结构化 `NationStyleSpec`
   （配色、建筑风格、地貌偏好、图腾关键词、散布密度）。
   **schema 校验通过才允许下游使用** —— 论文 2.1 的核心纪律
2. **GPT-Image**：按 spec 产出该国地表 tile 纹理（albedo）+ 国徽
3. **Tripo `text-to-model`**：产出该国 2–3 个散布原型（岩石 / 植被 / 图腾柱），
   `smart_low_poly=true`、`face_limit≈4000`、`compress=geometry`

**产物**：`NationStyleSpec` + 纹理 + 原型 GLB。mock 阶段落 localStorage 与本地静态目录
（见 §8），接真实后端后改为对象存储。此后该国所有散布实例复用这几个原型。

### 层 3 · 地标挂件（实时，国民触发）

1. 用户在 3D 地形上点击 → raycast 自有地形 mesh → 精确落点 + 表面法线
2. Tripo `text-to-model`，或 GPT-Image 出概念图后走 `image-to-model`（保真更高）
3. **归一化**：`Box3` 量包围盒 → 缩放至目标高度 → 原点移到底面中心 → 对齐地形法线
4. 生成期间显示占位体；完成后进审核队列，领袖核准后才对全体可见

---

## 3. 论文 → 本实现的替换表

| 论文 | 本实现 | 理由 |
|---|---|---|
| Claude Opus 4.8 规划 | GPT | 等价 |
| GPT-Image-2 语义布局图 | **ASCII 图升采样** | 世界形状是权威数据，不该生成 |
| GPT-Image-2 概念图 / 纹理 | GPT-Image | 1:1 对应 |
| Hunyuan3D 资产原型 | Tripo text/image-to-model | 平替 |
| **SAM3 分割 + SAM3D 重建 + Eq.10–13** | **删除**，改 raycast 拾取 | 位置已知，不需要反解 |
| Hunyuan3D 粗网格精修 | `/v3/mesh/complete` + `/v3/models/texture` | 近似替代 |
| Blender 材质节点图 | splat shader + GPT-Image tile | 浏览器端 |
| BlenderMCP 渲染批判循环 | **人工审核**（复用三级权限链） | 社区治理本就要人审，AI 自评是多余成本 |
| 4×H20 + Blender 5.1.1 服务端 | node 烘焙脚本 + three.js | 零 GPU 依赖 |

---

## 4. Tripo v3 接口与三个杠杆

Base URL `https://openapi.tripo3d.ai/v3`，`Authorization: Bearer {key}`，
异步任务模式：POST 建任务拿 `task_id`，`GET /v3/tasks/{task_id}` 轮询
（状态 queued / running / success / failed / cancelled）。与现有 `server/tripo.ts`
结构一致，改造量小。

**杠杆一 · 同几何不同贴图**：`model_seed` 固定 + `texture_seed` 变化，产出相同几何、
不同贴图的模型。一个地标原型给 N 国出 N 种涂装，成本约为逐国重新生成的 1/N。
这是国家定制化性价比最高的做法。

**杠杆二 · 低模拓扑**：`smart_low_poly=true` 配合 `face_limit`（1000–20000）产出
手工级低模。网页端同屏几十个模型时这是生死线。

**杠杆三 · 内置压缩**：`compress=geometry`（meshopt）省掉大半 gltf-transform 工作；
`/v3/mesh/decimate` 重拓扑兜底，`/v3/models/convert` 出 GLB。

**可选**：`/v3/animations/rig` 绑骨。社区反馈「Benchy 元素不足」，会动的 Benchy 舰队
是低成本高信号的补强。

API Key 只存在于服务端，前端只与 `/api/tripo/*` 通信。

---

## 5. 模块边界

```
tools/bake-world.ts   离线烘焙：ASCII → 掩膜 → 高度场 → 资产（node，无浏览器依赖）
shared/world/         纯函数：噪声、地貌算子、掩膜升采样、高度采样（可测）
server/               Tripo 代理 + 任务轮询 + 风格 spec 校验（key 只在这侧）
web/world/            three.js：地形 mesh、splat 材质、散布、拾取
web/assets/           GLB 归一化、加载、实例化
web/panels/           国家页、营造工坊、审核队列（复用现有面板）
```

每个单元的判据：`shared/world/` 不依赖 three.js 与浏览器 API，因此可在 node 下测；
`tools/bake-world.ts` 只消费 `shared/world/`；`web/world/` 只消费烘焙产物与
`shared/world/` 的采样函数，不重算高度场。

---

## 6. 测试

现有 22 项六角格测试随 odd-q 邻接算法一并作废，替换为：

1. **高度场确定性** —— 同种子同参数产出逐像素一致
2. **掩膜归一化** —— 升采样后任意点各区权重和 ≈ 1（误差 < 1e-6）
3. **边界软化** —— 软化过渡带宽度符合参数设定
4. **放置正确性** —— 落点解析采样高度与地形 mesh 实际交点高度之差 < 网格单元尺寸的 1%
5. **GLB 归一化** —— 任意尺寸 / 任意原点输入，输出高度 == 目标高度且底面在 y=0

---

## 7. 错误处理与降级

- Tripo 任务 `failed` 或超时 → 降级为程序化占位体，**不阻塞世界渲染**
- GPT 返回不符合 `NationStyleSpec` schema → 重试一次，再失败则回落预设风格模板
- 生成中的资产不进入公共世界，仅在提交者本人视图内显示为占位
- 烘焙脚本参数越界（如噪声权重和过大导致高度溢出）→ 烘焙期报错，不产出坏资产

---

## 8. 数据与持久化（mock 阶段）

后端持久化本轮不做。`nation_style`、`landmark`、审核队列全部落 localStorage +
内存 store，**但接口形状按最终后端设计**，将来接真实后端只替换 adapter 层。

---

## 9. 明确不做

- 不做领土争议仲裁玩法（运营口径明确要规避）
- 不做 AI 自动批判-精修循环（人工审核替代）
- 不做运行时全流程世界生成（成本与延迟不成立）
- 不引第三方地形库；高度场自有实现，因为要与掩膜和领土绑定
