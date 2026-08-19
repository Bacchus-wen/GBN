// 出网代理。Node 的全局 fetch 默认不读 HTTPS_PROXY / 系统代理，
// 表现是「DNS 能解析但 TCP 超时」，极易被误判成 API key 问题。
//
// Node 24 起有 --use-env-proxy 可以自动处理，但 Node 22 没有这个参数，
// 带上它会直接以 "bad option" 崩掉——所以不能依赖它，改为显式装 dispatcher。

import { ProxyAgent, setGlobalDispatcher } from 'undici'

/**
 * 若配置了 HTTPS_PROXY，就把全局 fetch 的 dispatcher 换成走代理的。
 * @returns 生效的代理地址，未配置时返回 null
 */
export function installProxy(): string | null {
  const url = process.env.HTTPS_PROXY ?? process.env.https_proxy
  if (!url) return null

  setGlobalDispatcher(new ProxyAgent(url))
  return url
}
