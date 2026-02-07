import path from 'node:path'
import process from 'node:process'
import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

const AI_PROVIDER = process.env.VITE_AI_PROVIDER || 'mistral'
const AI_API_KEY = process.env.VITE_AI_API_KEY || ''

const fixturesDir = path.join(import.meta.dirname, 'fixtures')

test.describe('Schedule Flow', () => {
  test.setTimeout(120_000)
  test.skip(AI_PROVIDER !== 'ollama' && !AI_API_KEY, 'No API key set and not using Ollama')

  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('SC-001: set custom schedule via chat tool', async ({ page }) => {
    // Configure AI provider
    await page.goto('/')
    await page.evaluate(({ provider, key }) => {
      localStorage.setItem('ai_provider', provider)
      localStorage.setItem('ai_api_key', key)
    }, { provider: AI_PROVIDER, key: AI_API_KEY })
    await page.reload()

    // Step 1: Create a vehicle (VW Golf VIII, 38.500 km — matches test-service-heft.png)
    await page.goto('/vehicles')
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    await page.getByLabel('Marke').fill('Volkswagen')
    await page.getByLabel('Modell').fill('Golf VIII')
    await page.getByLabel('Baujahr').fill('2021')
    await page.getByLabel('Kilometerstand').fill('38500')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Volkswagen Golf VIII').first()).toBeVisible({ timeout: 10_000 })

    // Step 2: Open chat
    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    // Step 3: Upload service book photo and ask to read intervals
    const fileInput = page.locator('.chat-drawer input[type="file"]').first()
    await fileInput.setInputFiles([
      path.join(fixturesDir, 'test-service-heft.png'),
    ])
    await expect(page.locator('.chat-drawer [data-pc-name="chip"]')).toHaveCount(1)

    const input = page.locator('.chat-drawer [placeholder="Nachricht..."]')
    await input.fill('Lies die Wartungsintervalle aus dem Service-Heft für meinen VW Golf')
    await page.locator('.chat-drawer button').filter({ has: page.locator('.pi-send') }).click()

    // Step 4: Wait for AI response with intervals (Phase 1 analysis)
    await expect(page.locator('.chat-message')).toHaveCount(3, { timeout: 60_000 })
    const phase1Msg = page.locator('.chat-message').last()
    await expect(phase1Msg).toContainText(/intervall|wartung|km|monate/i, { timeout: 30_000 })

    // Step 5: Confirm to save
    const chatInput = page.locator('.chat-drawer [placeholder="Nachricht..."]')
    await chatInput.fill('Ja, bitte speichern')
    await chatInput.press('Enter')

    // Step 6: Wait for tool execution result (set_maintenance_schedule)
    await expect(page.locator('.chat-message')).toHaveCount(5, { timeout: 60_000 })
    const finalMsg = page.locator('.chat-message').last()
    await expect(finalMsg).toContainText(/gespeichert|wartungsplan|positionen|erledigt/i, { timeout: 30_000 })

    // Step 7: Close chat via navigation and check VehicleDetailPage
    await page.goto('/vehicles')
    await page.getByText('Volkswagen Golf VIII').first().click()

    // Switch to maintenance tab (already default)
    await expect(page.getByText('Fahrzeugspezifischer Wartungsplan').first()).toBeVisible({ timeout: 15_000 })

    // DELETE (cleanup)
    await page.locator('button:has-text("Löschen")').first().click()
    await page.locator('[data-pc-name="dialog"]').getByRole('button', { name: 'Löschen' }).click()
    await expect(page.getByText('Volkswagen Golf VIII')).not.toBeVisible({ timeout: 5_000 })
  })
})
