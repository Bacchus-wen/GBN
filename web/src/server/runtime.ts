// 服务端运行时初始化。模块级副作用在每个 server 实例里只跑一次，
// 所有 route handler 都 import 它，保证出网代理在任何 fetch 之前装好。

import { installProxy } from './proxy'

const proxy = installProxy()

if (process.env.NODE_ENV !== 'production') {
  console.log(`[gbn] 出网代理: ${proxy ?? '未配置（直连）'}`)
}

export const proxyUrl = proxy
