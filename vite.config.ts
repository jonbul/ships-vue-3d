/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// ssl/ is a symlink to the workspace's shared ../files/ssl (the same cert
// ships-go-3d serves). HTTPS matters: the session cookie is Secure.
const sslKey = './ssl/key.pem'
const sslCert = './ssl/cert.pem'

export default defineConfig(({ mode }) => ({
  plugins: [vue(), mode === 'development' && vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    // Same port as ships-vue (2D), so the origins ships-go already allows
    // cover this site too. The two sites can't run at the same time.
    port: 5173,
    https: fs.existsSync(sslKey)
      ? { key: fs.readFileSync(sslKey), cert: fs.readFileSync(sslCert) }
      : undefined,
  },
  build: {
    // three.js is most of the bundle. Its own chunk is cached across
    // deploys of the app code; it is ~140 kB gzipped, hence the higher limit.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'] },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))
