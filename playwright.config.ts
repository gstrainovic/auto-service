import process from 'node:process'
import { defineConfig } from '@playwright/test'
import { config } from 'dotenv'

config({ path: '.env' })

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Disabled to avoid test interference with shared InstantDB
  workers: 1, // Run tests serially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  maxFailures: process.env.CI ? 0 : 1,
  webServer: [
    {
      command: 'npm run dev:vite',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
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
      use: {
        baseURL: 'http://localhost:5173',
        screenshot: 'only-on-failure',
        simulateOffline: false,
      },
    },
    {
      name: 'offline',
      testMatch: /.*\.spec\.ts/,
      use: {
        baseURL: 'http://localhost:5173',
        screenshot: 'only-on-failure',
        simulateOffline: true,
      },
      dependencies: ['online'],
    },
  ],
})
