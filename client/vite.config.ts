import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Anything the browser asks for under /api is forwarded to the Express server.
    proxy: {
      '/api': 'http://localhost:3001',
    }
  }
})
