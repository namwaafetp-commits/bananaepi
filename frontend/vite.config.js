import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/upload':   { target: 'http://localhost:8000', changeOrigin: true },
      '/projects': { target: 'http://localhost:8000', changeOrigin: true },
      '/analysis': { target: 'http://localhost:8000', changeOrigin: true },
      '/report':   { target: 'http://localhost:8000', changeOrigin: true },
      '/mapping':          { target: 'http://localhost:8000', changeOrigin: true },
      '/case-definition': { target: 'http://localhost:8000', changeOrigin: true },
      '/cleaning': { target: 'http://localhost:8000', changeOrigin: true },
      '/api/share':    { target: 'http://localhost:8000', changeOrigin: true },
      '/api/template': { target: 'http://localhost:8000', changeOrigin: true },
      '/health':   { target: 'http://localhost:8000', changeOrigin: true },
      '/payment':  { target: 'http://localhost:8000', changeOrigin: true },
      '/telegram': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
