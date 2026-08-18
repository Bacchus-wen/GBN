# GBN World Engine · 未决事项清单

来源：层 1「世界地形烘焙」计划的执行台账（八轮任务审查 + 一轮整分支终审）。
层 1 已完成合并，以下条目在执行过程中被识别、评估并明确延后，逐条附了位置与理由。

---

## 一、已裁定并入「地形调参」后续计划

这三项都需要重新烘焙 + 重新调参，合并成一次做。项目负责人 2026-08-18 裁定。

### 1. 噪声层各向异性（地表纹理东西向拉长 1.6 倍）

矩形世界的修正只贯穿到了区域掩膜层，噪声与地貌算子仍然吃归一化坐标 `u, v ∈ [0,1]`。
但 `u` 铺 400 世界单位、`v` 铺 250，同一个 `freq` 在 X 方向的世界波长是 Z 方向的 1.6 倍。

实测（单区域地图隔离掩膜影响，60000 随机点，d=1 世界单位有限差分）：

| profile | E&#124;dH/dx&#124; | E&#124;dH/dz&#124; | 比值（应为 1.0） |
|---|---|---|---|
| p 平原 | 0.00533 | 0.01016 | 1.906 |
| f 森林 | 0.01190 | 0.02144 | 1.801 |
| m 山地 | 0.09703 | 0.16201 | 1.670 |

同一根因也污染边界软化：`softness = 6` 掩膜像素在世界里是 X 方向 σ=4.70、Z 方向 σ=2.94。

**国界形状不受影响**（16×10 图按中心对中心映射，每源格约 26.67×27.78 世界单位，近似方形），
受影响的只是地表纹理被东西向抹开。修法是把噪声域改成按世界长宽比缩放的坐标。

位置：`shared/src/world/heightfield.ts` 第 55、58、67 行。

### 2. 垂直起伏偏弱

高度值域仅 `-6.32 ~ 26.48`（约 33 单位）铺在 400×250 的世界上，视觉上像丘陵而非
设计意图中的雪山、火山、峡谷。考虑引入垂直夸张系数，或调高 `m` / `v` 的 `base` 与 ridge 权重。

### 3. 相机取景未适配面板比例

地图面板是宽扁形状，而相机距离按 `Math.max(sizeX, sizeZ)` 换算，导致地形在视口里偏小。

位置：`web/src/world/WorldCanvas.tsx`。

---

## 二、层 2 / 层 3 的预备发现

在验证三个外部 API 时实测得到，会直接影响后续两层的设计。

### API 实测结论（2026-08-18）

- **Tripo v3**：`https://openapi.tripo3d.ai/v3`，Bearer 认证，异步 task + `GET /v3/tasks/{id}` 轮询。
  余额 1000 credits。已跑通一次 `text_to_model`（v2.5，`face_limit=4000`）全链路。
- **GPT 中转**：会往请求里注入约 5000 token 的 system prompt，且不遵循简单指令。
  **层 2 的规划 agent 必须靠 schema 校验兜底，不能依赖指令遵循。**
- **GPT-Image**：可用，返回第三方 CDN 图床 URL。

### 资产必须下载入库，不能挂外链

Tripo 返回的 GLB URL 带 CloudFront 签名与过期时间（实测约 24 小时）；
GPT-Image 返回的图片同样是第三方图床 URL。两者都必须下载后入库。

### 掩膜软权重在烘焙时被丢弃

`encodeRegions` 用 `dominantRegion` 把软掩膜塌缩成硬索引（`regions.bin` / `owners.bin`）。
层 2 若要做区域间材质的平滑混合，当前产物不够用，需要另烘焙权重贴图或改多通道编码。

位置：`shared/src/world/codec.ts`。

### `Landmark.placement` 的落点语义

层 1 收尾时已把 `Landmark` 的坐标字段从六角的 `col`/`row` 改成结构化的 `Placement`
（`x`/`y`/`z` + 法线）。层 3 恢复地标渲染时直接消费即可，不需要再做坐标转换。

### 前端目前不消费 regions/owners

`loadWorld` 每次加载都拉取 `regions.bin` + `owners.bin` 共 512KB，但 `web/src` 下零消费点。
层 2 做分国着色时正是要用它们；在那之前这是纯浪费的流量。

---

## 三、可延后的技术债

按影响从大到小排列。

### 健壮性

- **`decodeHeights` 对长度不符的 buffer 无校验**。实测截断的 `heightmap.bin` 会让
  `sampleHeight` 返回 `NaN`，地形整块消失且无报错。三行守卫即可。
  位置：`shared/src/world/codec.ts`。
- **`normalizeToHeight` 会永久改写 `children[i].position`**。共享模板对象在复用前需要
  先 `clone()`。函数本身幂等，shift 对所有子节点一致，相对布局不受破坏，风险较低。
  位置：`web/src/world/placement.ts`。
- **`tools/bake-world.ts` 不在任何 tsconfig 里**。实测注入类型错误后 `tsc` 仍退出 0。
  烘焙 CLI 是产出线上静态资产的唯一工具，却是全仓唯一无类型保护的可执行文件。

### 语义与一致性

- **`OpSpec.weight` 对 `erode` 是静默 no-op**。`case 'erode'` 只用 `op.k`，从不引用 `weight`，
  但 `profiles.ts` 里 `m` 明写了 `weight: 1`。调它毫无效果且无警告。
- **`profiles.ts` 的 `base` 与 `data.ts` 的 `TERRAIN.height` 是手工复制**，无代码或测试绑定。
  而 `TERRAIN.height` 正是界面图例上显示的「h20」。改了图例地形不变，改了 profile 图例说谎。
  一条相等性断言即可锁住。
- **`fbm` 对负 `gain` 不保证 `[-1,1]`**。当前调用路径 `gain` 恒为 0.5，不触发。

### 死代码与空承诺

- **`shared/src/data.ts` 仍导出整批六角死代码**：`MAP_W`/`MAP_H`/`CONTESTED`/`Contested`/
  `cellKey`/`parseCellKey`/`buildCells`/`Cell`。全仓库已无引用（`OWNER_MAP`/`TERRAIN_MAP`
  例外，烘焙 CLI 在用）。文件头注释仍写「odd-q 偏移六角网格」，已经是错的。
- **图层按钮（归属/地形/资源）当前无实际效果**。`state.layer` 唯一读取点是图例文案切换，
  地形材质是 `TerrainMesh.tsx` 里写死的 `color="#5d7a8c"`。按钮有 `aria-pressed` 高亮，
  看起来生效但地图纹丝不动。层 2 做分国着色时会兑现。
- **`ReviewQueue` 的 `scope === 'territory'` 分支与 `approveTerritory` 权限已无触达路径**
  （`ClaimPanel` 随领土玩法一并删除）。层 2 若恢复领土玩法可复用。
- **`state.view` / `ViewMode` 是无 UI 触发的死状态**。
- **`nationView` 是死函数**，核准纹理/故事无可见效果（先于本分支存在，`NationPanel`
  用的是 `nationById`）。本分支删掉领土审核后，内政核准成了审核链唯一活路径，
  这条断链的相对重要性上升了。
- **`TERRAIN` 表与图例向用户展示「░ 荒漠 h9」，但 `TERRAIN_MAP` 里没有 `d` 字符**，
  世界里不存在荒漠格，`dune` 算子在正式烘焙中从未执行过。
- **`NationPanel` 的空态文案「从地图选择一个国家」已无对应交互**——点地形现在返回落点，
  不返回归属国。层 2 可以用 `owners.bin` 把这个交互接回来。

### 测试

- **边界软化测试只验了单调性**（`band(8) > band(2)`），未钉住过渡带宽度与 σ 的定量关系。
  位置：`shared/src/world/masks.test.ts`。
- **`masks.ts` 的 `sum <= 0` 分支在真实输入下不可达**，唯一可触发的输入（`rows` 全空）下
  `data` 长度为 0，写入被静默丢弃。建议调用处加 `rows` 非空校验。

### 文档

- **设计文档三处与实现脱节**：`§2` 写「1024² 的区域掩膜」（实为 512²）、
  「分频噪声（simplex）」（实为 value noise）；产物清单里的「材质分配表」没有产出
  （`regions.bin` 是硬索引，非材质表）。
  位置：`docs/superpowers/specs/2026-08-18-gbn-world-engine-design.md`。

---

## 四、执行过程中被推翻的计划假设（存档）

这四处是计划写错、由实测推翻的，记下来避免以后重蹈。

1. **`erode` 对负值行为反向**。`erode(-6, 0, 0.5)` 返回 0（违反「坡度为 0 不改变原值」），
   `erode(-6, 10, 0.5)` 返回 24（负高程被侵蚀成正山峰）。已加负值护栏。
2. **16×10 的图升采样成正方形**，世界纵向拉伸 1.6 倍。已改为矩形世界 400×250。
   （但修正未贯穿到噪声层，见本文第一节第 1 条。）
3. **「解析采样与网格插值之差小于格宽 1%」在几何上不可能满足**。`ridge`/`terrace` 刻意
   制造锐利折线与阶跃，粗网格复现不了，且与噪声频率无关（调 freq 完全不改变偏差）。
   实测纯山脊区偏差 0.070、纯阶地区 0.028，容差 0.0157。
   已改为落点直接采 `sampleHeightOnMesh`，偏差恒为 0；法线仍取解析场梯度避免面片朝向突跳。
   终审用真实 raycast 复核：新方案误差 8.96e-7（0.0001% 单元），原方案 0.2195（14.0% 单元）。
4. **`normalizeToHeight` + `alignToNormal` 组合后物体恒下陷 `targetHeight/2`**。
   两个函数单独测都对，组合起来 `alignToNormal` 会覆盖前者写进 `position` 的落地校正。
   已改契约：归一化只负责把局部原点放到底面中心，不占用 `position`。
