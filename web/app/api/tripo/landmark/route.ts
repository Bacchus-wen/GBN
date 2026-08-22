import { createLandmark } from '../../../../src/server/tripo'
import { fail, ok } from '../../../../src/server/respond'
import '../../../../src/server/runtime'

export async function POST(req: Request) {
  try {
    const body = await req.json() as { prompt?: string; seedKey?: string }
    if (!body.prompt?.trim()) {
      return Response.json({ ok: false, error: 'prompt 不能为空' }, { status: 400 })
    }
    return ok(await createLandmark({ prompt: body.prompt, seedKey: body.seedKey }))
  } catch (e) {
    return fail(e)
  }
}
