// 首页。世界地图需要 WebGL 与浏览器 API，整段走客户端渲染；
// 外层的 metadata 仍由服务端产出（见 layout.tsx）。

import dynamic from 'next/dynamic'

const WorldApp = dynamic(() => import('../src/App'), {
  loading: () => <div className="wrap p14 s11 tm">加载世界…</div>,
})

export default function Home() {
  return <WorldApp />
}
