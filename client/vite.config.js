import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        // Dev-only proxy: forwards /api requests from the Vite dev server to
        // the backend. Override with VITE_API_PROXY_TARGET to point at a
        // different backend without editing this file, e.g.:
        //   VITE_API_PROXY_TARGET=http://localhost:8000 npm run dev
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:49160',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
