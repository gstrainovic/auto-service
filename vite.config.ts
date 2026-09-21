import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
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
