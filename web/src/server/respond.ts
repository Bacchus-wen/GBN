// route handler 的统一出参。沿用原 Hono 服务的信封格式 { ok, data } / { ok, error }，
// 前端 api 客户端不用改。

import { HttpError } from './tripo'

export const ok = <T>(data: T) => Response.json({ ok: true, data })

export function fail(e: unknown): Response {
  const status = e instanceof HttpError ? e.status : 500
  const error = e instanceof Error ? e.message : '未知错误'
  console.error('[gbn:api]', status, error)
  return Response.json({ ok: false, error }, { status })
}
