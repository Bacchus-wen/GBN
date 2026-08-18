import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Tripo 走服务端代理，key 不进前端
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
})
