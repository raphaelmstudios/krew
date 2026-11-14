import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API requests to the backend server running on port 4000.
    // This allows the frontend to make requests to /api and /uploads without CORS issues.
    // changeOrigin stays false so the server sees the browser's real address
    // (localhost:5173). The server only accepts requests that change data when they come
    // from KREW's own pages (sameOriginOnly in server/src/security.js), and it checks that
    // by comparing the page's address with this one - rewriting it to localhost:4000 made
    // every log in, sign up and form look like it came from another site.
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: false,
      },
      '/uploads': {
        target: 'http://localhost:4000',
        changeOrigin: false,
      },
    },
  },
})