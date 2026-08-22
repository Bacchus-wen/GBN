import { ingest } from '../../../../src/server/assets'
import { fail, ok } from '../../../../src/server/respond'
import '../../../../src/server/runtime'

export async function POST(req: Request) {
  try {
    const body = await req.json() as { url?: string; key?: string }
    if (!body.url?.trim()) {
      return Response.json({ ok: false, error: 'url 不能为空' }, { status: 400 })
    }
    return ok(await ingest(body.url, body.key))
  } catch (e) {
    return fail(e)
  }
}
