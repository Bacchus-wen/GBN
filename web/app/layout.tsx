// 根布局。三个 3D 场景相关的库都只能在客户端跑，所以页面主体是客户端组件，
// 但外壳（metadata / OG 卡片）留在服务端 —— 这正是迁 Next 的主要目的：
// 社区往 MakerWorld、Discord 贴链接时能展开成有国徽和数据的卡片。

import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GBN 世界地图 · Great Benchy Nations',
  description: '玩家自己写出来的 Benchy 跑团宇宙：建国、结盟、用打印为国家积累 GDP，用 Tripo 生成模型建设国家沙盘与展览馆。',
  openGraph: {
    title: 'GBN 世界地图',
    description: '疆域 · 资源 · AI 营造',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#0b1a2b',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
