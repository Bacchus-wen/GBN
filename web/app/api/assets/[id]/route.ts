import { readAsset } from '../../../../src/server/assets'
import { fail } from '../../../../src/server/respond'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { body, type } = await readAsset(id)
    return new Response(new Uint8Array(body), {
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (e) {
    return fail(e)
  }
}
