import type { Plugin } from 'vite'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { applyMetaToHtml, PAGE_META } from './src/lib/page-meta.ts'

// Kopf der Startseite in index.html, dazu dist/<pfad>/index.html pro öffentlicher Seite, damit Crawler ohne
// JavaScript den richtigen Titel sehen; Caddy liefert sie über `try_files {path}/index.html` aus.
function pageMetaPlugin(): Plugin {
  let outDir = 'dist'
  return {
    name: 'page-meta',
    configResolved(config) {
      outDir = config.build.outDir
    },
    transformIndexHtml: html => applyMetaToHtml(html, '/'),
    closeBundle() {
      const index = readFileSync(join(outDir, 'index.html'), 'utf8')
      for (const path of Object.keys(PAGE_META).filter(p => p !== '/')) {
        mkdirSync(join(outDir, path), { recursive: true })
        writeFileSync(join(outDir, path, 'index.html'), applyMetaToHtml(index, path))
      }
    },
  }
}

export default defineConfig({
  plugins: [
    vue(),
    pageMetaPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'robots.txt'],
      manifest: {
        name: 'Wartungsheft',
        short_name: 'Wartungsheft',
        description: 'Werkstattrechnung fotografieren, Service und MFK im Blick',
        theme_color: '#059669',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
  server: {
    // Fester Port (5173 kollidiert mit anderen Vite-Projekten); strictPort statt stillem Ausweichen auf den nächsten Port
    port: 6060,
    strictPort: true,
    proxy: {
      // Proxy für InstantDB Self-Hosted Server (HTTP + WebSocket)
      '/instant-api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/instant-api/, ''),
        ws: true,
      },
    },
  },
})
