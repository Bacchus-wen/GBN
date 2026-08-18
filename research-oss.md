# 开源调研 · GBN 3D 地图 + Tripo 生成

调研工具：agent-reach（GitHub gh CLI + Exa）· 2026-08-18

---

## 一、fal-worldclaw（用户指定，价值确认）

`blendi-remade/fal-worldclaw` · TypeScript · 21★ · 最后提交 2026-08-11 · **无 LICENSE**

Tencent Hunyuan3D「WorldClaw」论文（arXiv:2608.05248）的浏览器复刻：一句 prompt →
可漫游可编辑的 3D 世界，全流程跑在 fal 端点上。技术栈与我们高度重合：
Next.js 16 + three.js r182 + @react-three/fiber + drei + zustand，源码仅约 180KB。

### ⚠ 许可证

仓库没有 LICENSE 文件 = 保留所有权利。**不能直接把代码复制进产品**。
可行路径：读模式自己重写 / 联系作者要授权。下面列的都是「模式」，不是「代码」。

### 可直接借鉴的五处

| 文件 | 模式 | 对 GBN 的价值 |
|---|---|---|
| `src/app/api/fal/proxy/route.ts` | 8 行 `@fal-ai/server-proxy` + endpoint 白名单 | 替掉我们手写的 135 行 `server/tripo.ts`，key 不进浏览器 |
| `src/components/three/HeroAssets.tsx` | `useNormalizedModel`：Box3 量包围盒 → 按 targetHeight 缩放 → 原点移到底面中心 | **Tripo GLB 落到六角格上的关键**。AI 出的模型尺寸/原点约定各不相同，不归一化必然穿模或巨大化。正是 HANDOFF「下一步 glb 加载」卡住的点 |
| 同上 | 排队中显示 shimmering 占位体积 | 生成要 1–3 分钟，占位让世界从第一秒就有构图 |
| `src/components/three/channels.tsx` | instance-mask 渲染通道兼作拾取器 | 比 raycast 稳，且天然支持「每个模型是独立可选实例」 |
| `src/lib/procedural.ts` | 种子化程序化 scatter（树/石/草） | 沙盘装饰零边际成本铺满，不必每件都花钱生成 |

### 不适用的部分

它的地形是**连续高度场 + splat 材质**（`terrain.ts` / `bake.ts` / `placement.ts` 的地形段），
GBN 是**离散六角格**，这部分搬不过来，也不该搬 —— 六角格才能算邻接、算领土、增量更新。

---

## 二、最大发现：fal 直接托管 Tripo 官方模型

HANDOFF 把「Tripo key 无效」列为唯一阻塞项。**这个阻塞可以绕过**：

| 端点 | 说明 |
|---|---|
| `tripo3d/p1/text-to-3d` | Tripo P1 文生 3D |
| `tripo3d/h3.1/text-to-3d` | Tripo H3.1 文生 3D |
| `tripo3d/p1/image-to-3d` | 图生 3D |
| `tripo3d/h3.1/multiview-to-3d` | 多视角生 3D |
| `tripo3d/tripo/v2.5/multiview-to-3d` | v2.5 多视角 |

P1 入参：`prompt`（≤1024 字）、`face_limit`（48–20000）、`texture`（默认 true）、`model_seed`。
计价 $0.01 / credit。

四个直接收益：
1. 换 `FAL_KEY` 一把钥匙即可跑通，不必等 Tripo 开发者控制台的 key
2. `face_limit` 直接给网页端多模型场景定面数预算
3. `model_seed` 让 demo 可复现 —— mock 阶段尤其重要
4. 同一把 key 还能调 FLUX 出国旗/徽章、Patina 出无缝地表材质

注意：走 fal 是转售通道。正式商务合作方是 Tripo 本身，上线大概率仍要切回 Tripo 官方 OpenAPI。
**但开发/demo 阶段用 fal 可以立刻解除阻塞**，且两边接口都是「提交任务 + 轮询」，切换成本低。

---

## 三、六角地图参考

| 仓库 | 许可 | 状态 | 用途 |
|---|---|---|---|
| `vonWolfehaus/von-grid` | MIT · 391★ | 已归档 2021 | three.js 六角/方格系统经典参考：几何、拾取、寻路。MIT 可抄 |
| `Bunkerbewohner/threejs-hex-map` | MIT · 120★ | 2021 | 3D 六角地形图，含 `land-atlas.json` + `transitions.png`，**地形边界过渡贴图**做法值得借鉴 |
| `arscan/hexasphere.js` | 无 · 276★ | 2022 | 球面六角。**仍建议否**：12 个五边形是特例，会破坏 odd-q 邻接算法与领土计算 |
| `Hellenic/react-hexgrid` | MIT | 活跃 | 2D SVG 六角，我们已越过这一阶段 |

结论：`shared/` 现有的 odd-q 邻接 + 边界线段 + 22 项测试已经够用，**不引第三方六角库**，
von-grid 只当渲染与拾取的参考读物。

---

## 四、GLB 体积治理（决定页面能不能上线）

`donmccurdy/glTF-Transform` · MIT · 1946★ · 活跃

fal 社区实测链路：`resize 1024 → webp q80 → draco`，**压缩率 95–96%，单模型落到 400–800KB**。

对 GBN：几十个国家 × 地标 + 舰队 + 展馆模型，不做这步页面必炸。
当前构建产物已经 1.1MB（主要是 three.js），再叠原始 GLB 不可接受。
建议做成服务端入库钩子：Tripo 出 GLB → gltf-transform 压 → 存 CDN → 前端只见压缩版。

---

## 五、fal 官方社区 skill 仓

`fal-ai-community/skills`：
- `fal-models-catalog` — 全模型目录与参数（text-to-3d / image-to-3d 等分册）
- `fal-regenerate-3d` — GLB + three.js 完整落地配方（含上面那条压缩链路）
- `fal-gamedev` — 2D 素材流水线

本机已装 `fal-3d` / `fal-generate` / `fal-upscale` 等 skill，可直接调用。

---

## 六、对「地图能不能用 Tripo 生成」的结论

上一轮否掉了「Tripo 生成地图本体」，理由是单 mesh 无法分格、无法算邻接 —— 这个理由成立。
但存在一条两全的中间路线，worldclaw 已经验证：

- **骨架**：六角格数据结构自有（归属、地形、邻接、领土），保持可计算、可增量
- **皮肤**：格子顶面材质用 fal/FLUX + Patina 生成 → 每个国家有专属地表观感
- **挂件**：地标、舰队、吉祥物用 Tripo 文生 3D → 归一化 → 落到格心
- **点缀**：树石草用程序化 scatter，零成本铺满

对用户而言看到的就是「我的国家地图是 AI 生成的、和别人不一样」，
对系统而言领土算法完全不受影响。这条路线同时满足社区诉求和工程约束。
