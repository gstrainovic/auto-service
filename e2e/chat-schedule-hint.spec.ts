import process from 'node:process'
import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

const AI_PROVIDER = process.env.VITE_AI_PROVIDER || 'mistral'
const AI_API_KEY = process.env.VITE_AI_API_KEY || ''

test.describe('Chat Schedule Hint', () => {
  test.setTimeout(120_000)
  test.skip(AI_PROVIDER !== 'ollama' && !AI_API_KEY, 'No API key set and not using Ollama')

  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('CS-001: AI mentions service book hint when asking about maintenance status', async ({ page }) => {
    // Configure AI provider
    await page.goto('/')
    await page.evaluate(({ provider, key }) => {
      localStorage.setItem('ai_provider', provider)
      localStorage.setItem('ai_api_key', key)
    }, { provider: AI_PROVIDER, key: AI_API_KEY })
    await page.reload()

    // Create a vehicle without customSchedule
    await page.goto('/vehicles')
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    await page.getByLabel('Marke').fill('Toyota')
    await page.getByLabel('Modell').fill('Yaris')
    await page.getByLabel('Baujahr').fill('2020')
    await page.getByLabel('Kilometerstand').fill('45000')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Toyota Yaris').first()).toBeVisible({ timeout: 10_000 })

    // Open chat and ask about maintenance
    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    const input = page.locator('.chat-drawer [placeholder="Nachricht..."]')
    await input.fill('Was ist beim Yaris an Wartung fällig?')
    await page.locator('.chat-drawer button').filter({ has: page.locator('.pi-send') }).click()

    // Wait for AI response (welcome + user + assistant = 3 messages minimum)
    await expect(page.locator('.chat-message')).toHaveCount(3, { timeout: 60_000 })

    // AI should mention service book / allgemein / Service-Heft in its response
    const assistantMsg = page.locator('.chat-message').last()
    await expect(assistantMsg).toContainText(/Service-Heft|allgemein/i, { timeout: 30_000 })

    // Close chat via navigation
    await page.goto('/vehicles')
    await page.getByText('Toyota Yaris').first().click()
    await page.locator('button:has-text("Löschen")').first().click()
    await page.locator('[data-pc-name="dialog"]').getByRole('button', { name: 'Löschen' }).click()
    await expect(page.getByText('Toyota Yaris')).not.toBeVisible({ timeout: 5_000 })
  })

  test('CS-002: AI does NOT mention service book hint when customSchedule exists', async ({ page }) => {
    // Configure AI provider
    await page.goto('/')
    await page.evaluate(({ provider, key }) => {
      localStorage.setItem('ai_provider', provider)
      localStorage.setItem('ai_api_key', key)
    }, { provider: AI_PROVIDER, key: AI_API_KEY })
    await page.reload()

    // Create a vehicle with customSchedule
    await page.goto('/vehicles')
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    await page.getByLabel('Marke').fill('Mazda')
    await page.getByLabel('Modell').fill('3')
    await page.getByLabel('Baujahr').fill('2021')
    await page.getByLabel('Kilometerstand').fill('30000')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Mazda 3').first()).toBeVisible({ timeout: 10_000 })

    // Set customSchedule directly via InstantDB
    await page.waitForFunction(() => !!(window as any).__instantdb, { timeout: 10_000 })
    await page.evaluate(async () => {
      const { db, tx } = (window as any).__instantdb
      const result = await db.queryOnce({ vehicles: {} })
      const vehicles = result.data.vehicles || []
      const mazda = vehicles.find((v: any) => v.make === 'Mazda')
      if (mazda) {
        await db.transact([
          tx.vehicles[mazda.id].update({
            customSchedule: [
              { type: 'oelwechsel', label: 'Ölwechsel', intervalKm: 10000, intervalMonths: 12 },
              { type: 'inspektion', label: 'Inspektion', intervalKm: 20000, intervalMonths: 24 },
              { type: 'bremsen', label: 'Bremsen prüfen', intervalKm: 30000, intervalMonths: 24 },
            ],
          }),
        ])
      }
    })

    // Open chat and ask about maintenance
    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    const input = page.locator('.chat-drawer [placeholder="Nachricht..."]')
    await input.fill('Was ist beim Mazda an Wartung fällig?')
    await page.locator('.chat-drawer button').filter({ has: page.locator('.pi-send') }).click()

    // Wait for AI response
    await expect(page.locator('.chat-message')).toHaveCount(3, { timeout: 60_000 })

    // AI should show maintenance status but NOT mention service book hint
    const assistantMsg = page.locator('.chat-message').last()
    // Should contain maintenance-related content
    await expect(assistantMsg).toContainText(/Wartung|Ölwechsel|Fällig|Status|erledigt/i, { timeout: 30_000 })

    // The context shows "✅ Service-Heft" so AI should NOT suggest uploading it
    const msgText = await assistantMsg.textContent() || ''
    expect(msgText).not.toMatch(/Service-Heft.*fotograf|Service-Heft.*hochladen|Service-Heft.*schick/i)

    // Close chat via navigation
    await page.goto('/vehicles')
    await page.getByText('Mazda 3').first().click()
    await page.locator('button:has-text("Löschen")').first().click()
    await page.locator('[data-pc-name="dialog"]').getByRole('button', { name: 'Löschen' }).click()
    await expect(page.getByText('Mazda 3')).not.toBeVisible({ timeout: 5_000 })
  })
})
