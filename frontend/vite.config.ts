import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Sends frontend /api requests to the local Spring Boot server.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})