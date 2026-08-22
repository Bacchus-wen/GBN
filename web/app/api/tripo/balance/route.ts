import { getBalance } from '../../../../src/server/tripo'
import { fail, ok } from '../../../../src/server/respond'
import '../../../../src/server/runtime'

export async function GET() {
  try {
    return ok(await getBalance())
  } catch (e) {
    return fail(e)
  }
}
