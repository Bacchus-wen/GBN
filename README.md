# GBN 离线浏览包

Great Benchy Nations 两个开发站点的本地离线副本。

## 包含页面

| 目录 | 原站 | 说明 |
|------|------|------|
| `activity/` | https://gbn-activity-e29a-dev.bbljsp.com/ | GBN 经济赛季活动页（React） |
| `timeline/` | https://gbn-timeline-e29a-dev.bbljsp.com/ | 社区时间线分析页（含 `data.json`） |

## 使用方法

1. 解压本压缩包到任意目录
2. **推荐**：双击 `启动本地服务器.bat`
3. 浏览器访问 http://localhost:8080/

### 手动启动

```bash
# Python
python -m http.server 8080

# 或 Node.js
npx serve -l 8080
```

## 说明

- 活动页为 Vite 构建的 ES Module 应用，需通过 HTTP 访问（`file://` 协议下浏览器可能拦截模块加载）。
- 时间线页的数据已内嵌在 `timeline/data.json`，可完全离线浏览。
- 活动页的业务数据已打包在 JS 中，无需联网 API。
- 页面内指向 MakerWorld 的链接仍会跳转外网；字体已本地化。
- 根路径 `/` 在线站返回健康检查 `ok`，实际入口为 `/index.html`。

打包时间：2026-07-08
