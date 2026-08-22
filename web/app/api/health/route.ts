import { hasKey } from '../../../src/server/tripo'
import { proxyUrl } from '../../../src/server/runtime'

export async function GET() {
  return Response.json({ ok: true, tripoKey: hasKey(), proxy: Boolean(proxyUrl) })
}
