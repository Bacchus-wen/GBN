# GBN 世界地图 3D 化 · Handoff

2026-08-18。把 `activity-v2/` 的 2D SVG 伪 3D 原型重建为 three.js 真 3D，接入 Tripo 生成
国家地标。代码在 `shared/` `server/` `web/` 三个 npm workspace 里。

## 一、先跑起来

```bash
cd ~/Downloads/gbn-offline-pack
npm run dev            # 同时起 server(8787) 和 web(5173)
```

打开 http://localhost:5173/

单独起：`npm run dev:web` / `npm run dev:server`
测试：`npx vitest run`（22 个断言）
构建：`npm run build`

## 二、当前状态

| 模块 | 状态 |
|---|---|
| 3D 地图渲染、拾取、图层、远景视图 | ✅ 浏览器实测通过 |
| 三级权限审核链 | ✅ 三种身份逐一验证 |
| AI 草案硬约束 | ✅ 四种绕过路径全部拦住 |
| 几何/领土算法迁移 | ✅ 22/22 vitest |
| Tripo 接入代码 | ✅ 写完，网络通 |
| Tripo 真实调用 | ❌ **key 无效，卡在这里** |

### 唯一的阻塞项：Tripo API Key

你给的 `tcli_e1e...` 被 Tripo 拒绝：

```
v3 /account/balance → {"code":2,"message":"Invalid API key"}
v2 /user/balance    → {"code":1002,"message":"Authentication failed"}
```

v2/v3 都失败，所以不是 API 版本问题。判断是 **key 类型不对**：`tcli_` 前缀是
Tripo CLI 的 token，OpenAPI 要的是开发者控制台建的 key。

**要做的事**：去 https://developers.tripo3d.ai/en/keys 建 API Key，替换
`server/.env` 里的 `TRIPO_API_KEY`，然后：

```bash
curl -s http://localhost:8787/api/tripo/balance
# 期望 {"ok":true,"data":{"balance":...}}
```

通了之后在页面上：选一格本国领土 → AI 营造工坊 → 「生成地标」→ 改写 prompt →
调用 Tripo → 等 1–3 分钟 → 提交领袖核准。

## 三、环境坑（已修，但要知道）

**你的 Mac 走本机代理 `127.0.0.1:7897`，Node 的 fetch 不读 macOS 系统代理。**

症状是「DNS 能解析、TCP 443 全超时」，极易误判成 key 或代码问题。我排查时就先
撞了这个，再撞 key 无效。

已修：`server/package.json` 的 dev/start 加了 `--use-env-proxy`，`.env` 里写了
`HTTPS_PROXY`。换网络环境（比如公司网不需要代理）时把 `.env` 里那行注掉。

`server/.env` 已被 `.gitignore:13` 覆盖，不会进 git。key 只在服务端，前端只跟
`/api/tripo/*` 说话。

## 四、架构与关键决定

```
shared/src/     数据 + 几何 + 领土算法（server 和 web 共用）
  data.ts       两张 16×10 ASCII 图 + TERRAIN 高度表 + 7 国 mock
  hex.ts        odd-q 邻接、中心坐标、颜色推导
  territory.ts  边界线段、资源统计、认领校验
  hex.test.ts   22 个断言
server/src/     Hono，只做 Tripo 代理
  tripo.ts      v3 客户端，异步任务 + 轮询
web/src/
  map/          three.js 场景
  panels/       6 个面板（React 重写自 app.js）
  state/store.ts  useReducer 单点状态
```

### 地图仍然是「改 ASCII 图即改地图」

`shared/src/data.ts` 里 `OWNER_MAP`（归属）和 `TERRAIN_MAP`（地形）两张 16×10
字符图，这个 authoring 方式从 2D 版完整保留。改图即改地图，不用碰渲染代码。

### 为什么不用 Tripo 生成地图本体

原规划写的是「国家地图用 Tripo 生成」，**这条被否了**。Tripo 输出单个 mesh，无法
分格、无法算邻接、无法增量更新领土 —— 会直接废掉「玩家绘制边界 + 争议格仲裁」。

所以：**地图骨架自有结构化数据，Tripo 只生成往骨架上挂的内容**（地标、纹理、
展览馆模型、Benchy 舰队）。

### 3D 形态：路线 A + 远景镜头

这**推翻了 8-17 定的「2D 六角板、排除 3D 地球仪」约束**（社区反馈里 3D 地图是
讨论度最高的诉求）。做法是六棱柱挤出 + 正交相机 + 轨道旋转，「地球仪感」只是一个
**镜头模式**，不重建几何、不动数据结构。实测切到远景仍是 75 格，同一份数据。

没走 hexasphere.js（12 个五边形是特例，会推翻邻接算法和 ASCII authoring），也没走
react-globe.gl（为真实地理国家设计，与 Voxel/Retro 冲突）。

### AI 硬约束落在哪一行

`web/src/panels/AiWorkshop.tsx` 的 `canSubmit`：

```ts
const canSubmit = trimmed.length >= 4 && trimmed !== (ai.text ?? '').trim()
```

`TripoPanel.tsx` 同理（prompt 必须改写才能调 Tripo）。实测拦住了：空、过短、
照抄 AI 原文、原文加空格绕过。

### 三级权限

内政（地形/地标/纹理/故事）→ 国家领袖核准，且只能核准**本国**的。
领土变更/争议格 → 只有社区管理员能裁决，领袖也不能自批。
判定在 `ReviewQueue.tsx` 的 `canAct`。

## 五、下一步建议

1. **换 key，跑通 Tripo**（唯一阻塞）
2. glb 加载进场景 —— 现在核准后只落一个图钉方块（`HexMap.tsx` 的 `Pins`），
   `modelUrl` 已存在 Landmark 类型里但还没用 `GLTFLoader` 加载
3. 纹理贴顶面 —— `/api/tripo/texture` 接口写好了，前端还没接
4. 国家展览馆 / 沙盘（规划里有，这轮没做）
5. 经济系统：MW 耗材 → 经济点数 → Tripo 活动点数（这轮没做）
6. 代码分割 —— 构建产物 1.1MB，主要是 three.js，可以 dynamic import

## 六、已知遗留

- `web/dist/` 是我 build 验证的产物，可删
- `activity-v2/` 保留为 2D 对照基准，没动
- `activity/` 是原站 Vite 构建产物、无源码，没动
- 地标 pin 现在是占位方块，不是真模型
- 数据全是 mock，没有后端持久化（`server/` 只有 Tripo 代理）
- 截图验证用 `opencli browser gbn screenshot` 会 CDP 超时（WebGL 持续重绘），
  我改用 `eval` 读 DOM 验证。要看渲染效果自己开浏览器
