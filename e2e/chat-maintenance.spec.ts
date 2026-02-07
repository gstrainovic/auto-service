import process from 'node:process'
import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

const AI_PROVIDER = process.env.VITE_AI_PROVIDER || 'mistral'
const AI_API_KEY = process.env.VITE_AI_API_KEY || ''

test.describe('Chat Maintenance Tool', () => {
  test.setTimeout(120_000)
  test.skip(AI_PROVIDER !== 'ollama' && !AI_API_KEY, 'No API key set and not using Ollama')

  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('CM-001: add maintenance entry via chat without invoice', async ({ page }) => {
    // Setup: Create a vehicle and configure AI
    await page.goto('/')
    await page.evaluate(({ provider, key }) => {
      localStorage.setItem('ai_provider', provider)
      localStorage.setItem('ai_api_key', key)
    }, { provider: AI_PROVIDER, key: AI_API_KEY })
    await page.reload()

    // Create a vehicle first
    await page.goto('/vehicles')
    await page.getByRole('button', { name: /Fahrzeug hinzufügen/ }).click()
    await page.getByLabel('Marke').fill('VW')
    await page.getByLabel('Modell').fill('Golf')
    await page.getByLabel('Baujahr').fill('2020')
    await page.getByLabel('Kilometerstand').fill('55000')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('VW Golf').first()).toBeVisible({ timeout: 10_000 })

    // Open chat and ask to add a maintenance entry (explicitly WITHOUT invoice)
    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    const chatInput = page.locator('[data-pc-name="drawer"]').getByPlaceholder('Nachricht...')
    await chatInput.fill('Trage bitte eine Wartung ohne Rechnung ein für den Golf: Ölwechsel am 2025-06-15 bei 52000 km.')
    await page.locator('[data-pc-name="drawer"]').locator('.chat-fab-send').click()

    // Wait for AI response — may need multiple confirmations
    await expect(page.locator('.chat-message')).toHaveCount(3, { timeout: 60_000 })

    // Check if AI completed or needs confirmation — send up to 2 confirmations
    for (let i = 0; i < 2; i++) {
      const lastMsg = page.locator('.chat-message-assistant').last()
      const text = await lastMsg.textContent() || ''
      if (/eingetragen|erstellt|hinzugefügt|gespeichert|erledigt|Wartung.*erfasst/i.test(text))
        break
      await chatInput.fill('Ja, bitte so eintragen')
      await chatInput.press('Enter')
      const expectedCount = 3 + (i + 1) * 2
      await expect(page.locator('.chat-message')).toHaveCount(expectedCount, { timeout: 60_000 })
    }

    // Close chat via navigation (more reliable than Close button)
    await page.goto('/vehicles')
    await page.getByText('VW Golf').first().click()

    // Check maintenance tab — should show the Ölwechsel entry
    await page.getByRole('tab', { name: /Wartung/ }).click()
    await expect(page.getByText(/Ölwechsel/i).first()).toBeVisible({ timeout: 10_000 })

    // Verify NO spurious invoice was created (add_maintenance should not create invoices)
    await page.getByRole('tab', { name: /Rechnungen/ }).click()
    await expect(page.getByText(/Keine Rechnungen/i)).toBeVisible({ timeout: 5_000 })

    // Cleanup: delete vehicle
    await page.locator('button:has-text("Löschen")').first().click()
    await page.locator('[data-pc-name="dialog"]').getByRole('button', { name: 'Löschen' }).click()
    await expect(page.getByText('VW Golf')).not.toBeVisible({ timeout: 5_000 })
  })
})
