import process from 'node:process'
import { defineConfig } from '@playwright/test'
import { config } from 'dotenv'

// .env-Werte auch dann verwenden, wenn die Shell dieselbe Variable exportiert (z.B. MISTRAL_API_KEY in ~/.bashrc)
const envFile = config({ path: '.env' }).parsed ?? {}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Disabled to avoid test interference with shared InstantDB
  workers: 1, // Run tests serially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  maxFailures: process.env.CI ? 0 : 1,
  webServer: [
    {
      command: 'VITE_INSTANTDB_MODE=local VITE_AI_PROXY_URL=http://localhost:8787 npm run dev:vite',
      url: 'http://localhost:6060',
      reuseExistingServer: !process.env.CI,
    },
    {
      // AI-Proxy im Auth-Bypass (User-ID aus Header, wie der Frontend-Bypass im lokalen Modus)
      command: 'npm run dev:proxy',
      url: 'http://localhost:8787/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
      env: {
        AI_PROXY_AUTH_BYPASS: '1',
        // alle Tests teilen einen Nutzer: Fair-Use-Bremse (20/min) würde die Chat-Tests mit 429 stoppen
        AI_PROXY_BURST_LIMIT: '10000',
        PORT: '8787',
        MISTRAL_API_KEY: envFile.MISTRAL_API_KEY ?? '',
        INSTANT_API_URI: envFile.INSTANT_API_URI ?? 'http://localhost:8888',
        INSTANT_APP_ID: envFile.INSTANT_APP_ID ?? '',
        INSTANT_ADMIN_TOKEN: envFile.INSTANT_ADMIN_TOKEN ?? '',
        // Jahresrechnung mit Beispiel-IBAN; ohne RESEND_TOKEN wird nichts verschickt, nur protokolliert
        INVOICE_IBAN: 'CH93 0076 2011 6238 5295 7',
        INVOICE_CREDITOR_NAME: 'Goran Strainovic',
        INVOICE_TRADE_NAME: 'Strainovic IT',
        INVOICE_BRAND: 'Wartungsheft',
        INVOICE_STREET: 'Bahnstrasse 9b',
        INVOICE_ZIP: '9323',
        INVOICE_CITY: 'Steinach',
        INVOICE_EMAIL: 'info@wartungsheft.ch',
        RESEND_TOKEN: '',
      },
    },
    {
      command: 'cd ~/instant/server && podman-compose -f docker-compose-dev.yml up',
      url: 'http://localhost:8888',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
  ],

  projects: [
    {
      name: 'online',
      testMatch: /.*\.spec\.ts/,
      grepInvert: /@soft/,
      use: {
        baseURL: 'http://localhost:6060',
        screenshot: 'only-on-failure',
        simulateOffline: false,
      },
    },
    {
      name: 'offline',
      testMatch: /.*\.spec\.ts/,
      grepInvert: /@soft/,
      use: {
        baseURL: 'http://localhost:6060',
        screenshot: 'only-on-failure',
        simulateOffline: true,
      },
      dependencies: ['online'],
    },
    {
      // Aufnahme der Werbe-Clips (video-scripts/, `npm run video`): kein Test, sondern gespielte Szenen im
      // Handyformat mit Videomitschnitt. Läuft nie in online/offline, weil die Dateien auf .video.ts enden.
      name: 'video',
      testMatch: /.*\.video\.ts/,
      use: {
        baseURL: 'http://localhost:6060',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        video: { mode: 'on', size: { width: 1170, height: 2532 } },
        simulateOffline: false,
      },
    },
    {
      // Weiche KI-Tests (Formulierung statt Endzustand): nur auf Anfrage via npm run test:e2e:soft
      name: 'ai-soft',
      testMatch: /.*\.spec\.ts/,
      grep: /@soft/,
      use: {
        baseURL: 'http://localhost:6060',
        screenshot: 'only-on-failure',
        simulateOffline: false,
      },
    },
  ],
})
