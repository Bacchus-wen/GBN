import type { NextConfig } from 'next'

const config: NextConfig = {
  // 不要自动生成 AGENTS.md / CLAUDE.md，本仓的约定写在 docs/ 里
  agentRules: false,
  // shared 是同仓 workspace 且直接导出 .ts 源码，需要让 Next 一起编译
  transpilePackages: ['@gbn/shared'],
}

export default config
