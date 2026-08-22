# 部署到 Vercel

## 一、项目设置

仓库是 npm workspaces（`shared` + `web`），Next 应用在 `web/`。

在 Vercel 导入仓库后：

| 设置项 | 值 |
|---|---|
| Framework Preset | Next.js |
| Root Directory | `web` |
| Include files outside root directory | **开**（`shared/` 在 root 之外，不开会构建失败） |
| Build Command | 留默认（`next build`） |
| Install Command | 留默认 |

## 二、环境变量

在 Vercel 的 Settings → Environment Variables 里配：

| 变量 | 必需 | 说明 |
|---|---|---|
| `TRIPO_API_KEY` | ✅ | 没有它生成接口会返回 503，但世界地图本身照常渲染 |
| `BLOB_READ_WRITE_TOKEN` | 推荐 | 在 Vercel 建一个 Blob Store 后会自动注入。见下节 |
| `HTTPS_PROXY` | ❌ **不要配** | 那是本地翻墙用的。Vercel 上直连，配了反而会把请求打到不存在的地址 |

`web/.env.local` 不会被部署（已在 .gitignore 里），线上只认 Vercel 的环境变量。

## 三、资产存储（这一步不做会有后果）

Tripo 返回的模型 URL 带签名，**约 24 小时后失效**。所以生成出来的模型必须转存。

存储驱动会按环境自动选，无需改代码：

| 驱动 | 触发条件 | 行为 |
|---|---|---|
| `blob` | 有 `BLOB_READ_WRITE_TOKEN` | 转存到 Vercel Blob，永久有效 |
| `fs` | 本地开发 | 写 `web/.assets/` |
| `passthrough` | 在 Vercel 上但没配 Blob | **直接回传远端地址，约 24h 后模型全部 404** |

只是给人看几天的 demo，`passthrough` 能用；但只要有人隔天再打开分享链接，模型就没了。
建 Blob Store 只需要在 Vercel 面板点两下，建议直接做。

**部署后第一件事**：打开 `https://<你的域名>/api/health`，确认返回里
`assetDriver` 是 `blob` 而不是 `passthrough`。

```json
{ "ok": true, "tripoKey": true, "proxy": false, "assetDriver": "blob" }
```

## 四、已知限制

- **生成的地标不会持久化**。目前只存在于访问者自己的浏览器会话里，刷新即消失。
  每个访客看到的是同一个基础世界 + 自己生成的东西，世界不会累积。
  这是 mock 阶段的设计，接真实后端时一并解决。
- **Tripo 生成要 1–3 分钟**，期间前端每 3 秒轮询一次。轮询本身很快，
  只有资产转存那一步耗时较长，已设 `maxDuration = 60`。
- **Hobby 计划的函数超时是 10 秒**，如果转存大模型时报超时，
  要么升级计划，要么在生成时用更小的 `face_limit`。
- 烘焙产物（`web/public/world/*.bin`，共 1.1MB）已随仓库提交，
  部署时不需要跑 `npm run bake:world`。只有改了 ASCII 地图才需要重新烘焙并提交。
