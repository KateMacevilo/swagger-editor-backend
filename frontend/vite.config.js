import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Inside Docker the backend on the host machine is reachable via host.docker.internal;
// locally it is plain localhost. Override with the VITE_API_TARGET env var if needed.
const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      }
    }
  }
})
