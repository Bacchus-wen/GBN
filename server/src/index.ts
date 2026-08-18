// GBN 服务端。目前只做 Tripo 代理 —— API Key 留在这一侧，前端不接触。
import { serve } from '@hono/node-server'
import { installProxy } from './proxy.js'
import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import {
  HttpError, createLandmark, createTexture, getBalance, getTask, hasKey,
} from './tripo.js'

const app = new Hono()

// 只放行本地 Vite dev server
app.use('/api/*', cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }))

app.get('/api/health', c => c.json({ ok: true, tripoKey: hasKey() }))

app.get('/api/tripo/balance', async c => {
  try {
    return c.json({ ok: true, data: await getBalance() })
  } catch (e) {
    return fail(c, e)
  }
})

/** 生成地标 → 返回 task_id，前端轮询 */
app.post('/api/tripo/landmark', async c => {
  try {
    const body = await c.req.json<{ prompt?: string; seedKey?: string }>()
    if (!body.prompt?.trim()) {
      return c.json({ ok: false, error: 'prompt 不能为空' }, 400)
    }
    const ref = await createLandmark({ prompt: body.prompt, seedKey: body.seedKey })
    return c.json({ ok: true, data: ref })
  } catch (e) {
    return fail(c, e)
  }
})

/** 生成地形纹理 */
app.post('/api/tripo/texture', async c => {
  try {
    const body = await c.req.json<{ prompt?: string; seedKey?: string }>()
    if (!body.prompt?.trim()) {
      return c.json({ ok: false, error: 'prompt 不能为空' }, 400)
    }
    const ref = await createTexture({ prompt: body.prompt, seedKey: body.seedKey })
    return c.json({ ok: true, data: ref })
  } catch (e) {
    return fail(c, e)
  }
})

/** 轮询任务。前端每 3s 拉一次直到 success/failed。 */
app.get('/api/tripo/task/:id', async c => {
  try {
    return c.json({ ok: true, data: await getTask(c.req.param('id')) })
  } catch (e) {
    return fail(c, e)
  }
})

function fail(c: Context, e: unknown) {
  const status = e instanceof HttpError ? e.status : 500
  const msg = e instanceof Error ? e.message : '未知错误'
  console.error('[tripo]', status, msg)
  return c.json({ ok: false, error: msg }, status as ContentfulStatusCode)
}

const port = Number(process.env.PORT ?? 8787)
// 必须在任何 fetch 之前装好，否则出网请求不走代理
const proxy = installProxy()

console.log(`GBN server → http://localhost:${port}`)
console.log(`  Tripo key: ${hasKey() ? '已配置' : '缺失'}`)
console.log(`  出网代理: ${proxy ?? '未配置（直连）'}`)
serve({ fetch: app.fetch, port })
