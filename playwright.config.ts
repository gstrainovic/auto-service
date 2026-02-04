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
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
  },
})
