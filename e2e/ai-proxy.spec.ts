import type { Page } from '@playwright/test'
import { clearInstantDB, countEntities, expect, test, waitForEntity } from './fixtures/test-fixtures'

const PROXY = 'http://localhost:8787'
const USER = 'e2e-test-user'

interface UsageInfo {
  plan: string
  month: string
  usage: { ocrPages: number, chatTokens: number }
  limits: { ocrPages: number, chatTokens: number }
}

async function readUsage(page: Page): Promise<UsageInfo> {
  return page.evaluate(async ({ proxy, user }) => {
    const res = await fetch(`${proxy}/me/usage`, { headers: { 'x-user-id': user } })
    return res.json()
  }, { proxy: PROXY, user: USER })
}

async function setUsage(page: Page, usage: { ocrPages: number, chatTokens: number }): Promise<void> {
  const res = await page.request.put(`${PROXY}/test/usage`, {
    headers: { 'x-user-id': USER },
    data: { usage },
  })
  expect(res.ok()).toBe(true)
}

test.describe('AI Proxy (Abo-Modus)', () => {
  test.setTimeout(120_000)

  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
    await setUsage(page, { ocrPages: 0, chatTokens: 0 })
  })

  test('AP-001: chat runs through the proxy and counts tokens, no API key in the browser', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.removeItem('ai_api_key'))
    await page.reload()

    const before = await readUsage(page)

    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()
    const input = page.getByPlaceholder('Nachricht...')
    await input.fill('Trage bitte einen Skoda Octavia Baujahr 2020 mit 41000 km und Kennzeichen ZH 123456 ein.')
    await page.locator('[data-pc-name="drawer"]').locator('button:has(.pi-send)').click()
    await expect(page.locator('.chat-message:not(.chat-message-loading)')).toHaveCount(3, { timeout: 60_000 })

    for (let round = 1; round <= 2; round++) {
      if (await waitForEntity(page, 'vehicles', 3_000))
        break
      await input.fill('Ja, bitte eintragen')
      await input.press('Enter')
      await expect(page.locator('.chat-message:not(.chat-message-loading)')).toHaveCount(3 + 2 * round, { timeout: 60_000 })
    }
    expect(await countEntities(page, 'vehicles')).toBeGreaterThan(0)

    const after = await readUsage(page)
    expect(after.usage.chatTokens).toBeGreaterThan(before.usage.chatTokens)
  })

  test('AP-002: reaching the monthly limit shows a German limit message in the chat', async ({ page }) => {
    await page.goto('/')
    const info = await readUsage(page)
    await setUsage(page, { ocrPages: 0, chatTokens: info.limits.chatTokens })

    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()
    const input = page.getByPlaceholder('Nachricht...')
    await input.fill('Hallo')
    await page.locator('[data-pc-name="drawer"]').locator('button:has(.pi-send)').click()

    const lastMsg = page.locator('.chat-message:not(.chat-message-loading)').last()
    await expect(lastMsg).toContainText(/Monatslimit erreicht/, { timeout: 30_000 })
    await expect(lastMsg).toContainText(/Chat-Tokens/)
  })

  test('AP-003: settings show plan and usage instead of an API key field', async ({ page }) => {
    await page.goto('/')
    await setUsage(page, { ocrPages: 2, chatTokens: 1234 })
    await page.goto('/settings')

    const card = page.locator('.settings-card', { hasText: 'Abo & Nutzung' })
    await expect(card).toBeVisible()
    await expect(card).toContainText('Free')
    await expect(card).toContainText(/2\s*\/\s*5/)
    await expect(card).toContainText(/1[’'.]?234\s*\/\s*100[’'.]?000/)
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
  })
})
