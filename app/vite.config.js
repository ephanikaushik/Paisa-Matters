import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const n8n = env.N8N_BASE_URL || 'http://localhost:5678'
  return {
    plugins: [react()],
    server: {
      port: 5175, strictPort: true,
      proxy: { '/api': { target: n8n, changeOrigin: true, rewrite: p => p.replace(/^\/api/, '/webhook') } },
    },
  }
})
