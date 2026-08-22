import { hasKey } from '../../../src/server/tripo'
import { activeDriver } from '../../../src/server/assets'
import { proxyUrl } from '../../../src/server/runtime'

export async function GET() {
  return Response.json({
    ok: true,
    tripoKey: hasKey(),
    proxy: Boolean(proxyUrl),
    // 部署后先看这个：passthrough 说明资产没有持久化，模型链接约 24h 后会失效
    assetDriver: activeDriver(),
  })
}
