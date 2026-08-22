import { getTask } from '../../../../../src/server/tripo'
import { fail, ok } from '../../../../../src/server/respond'
import '../../../../../src/server/runtime'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    return ok(await getTask(id))
  } catch (e) {
    return fail(e)
  }
}
