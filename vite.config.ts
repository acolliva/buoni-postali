import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // In development, /api goes to the home server if it is running
  // (`npm run serve`); otherwise the app falls back to browser storage.
  server: { proxy: { '/api': 'http://localhost:8080' } },
  test: { include: ['src/**/*.test.ts'] },
})
