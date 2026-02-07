import process from 'node:process'
import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

const AI_PROVIDER = process.env.VITE_AI_PROVIDER || 'mistral'
const AI_API_KEY = process.env.VITE_AI_API_KEY || ''

test.describe('Chat Tool Result Cards', () => {
  test.setTimeout(120_000)
  test.skip(AI_PROVIDER !== 'ollama' && !AI_API_KEY, 'No API key set and not using Ollama')

  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('TC-001: creating a vehicle via chat shows a tool result card', async ({ page }) => {
    // Configure AI provider
    await page.goto('/')
    await page.evaluate(({ provider, key }) => {
      localStorage.setItem('ai_provider', provider)
      localStorage.setItem('ai_api_key', key)
    }, { provider: AI_PROVIDER, key: AI_API_KEY })
    await page.reload()

    // Create vehicle via chat
    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    const input = page.locator('[data-pc-name="drawer"]').getByPlaceholder('Nachricht...')
    await input.fill('Erstelle einen BMW 320d Baujahr 2021 mit 45000 km und Kennzeichen M-BW 1234')
    await page.locator('[data-pc-name="drawer"]').locator('.chat-fab-send').click()

    // Wait for AI response
    await expect(page.locator('.chat-message')).toHaveCount(3, { timeout: 60_000 })

    // If AI asks for confirmation, confirm
    const lastMsg = page.locator('.chat-message-assistant').last()
    const text = await lastMsg.textContent() || ''
    if (!/angelegt|erstellt|gespeichert|erledigt/i.test(text)) {
      await input.fill('Ja, bitte eintragen')
      await input.press('Enter')
      await expect(page.locator('.chat-message')).toHaveCount(5, { timeout: 60_000 })
    }

    // A tool result card should be visible in any assistant message
    const toolCard = page.locator('[data-pc-name="drawer"] .tool-result-card')
    await expect(toolCard.first()).toBeVisible({ timeout: 10_000 })

    // Card should contain vehicle data
    await expect(toolCard.first()).toContainText(/BMW/i)

    // Card should be a PrimeVue Panel (toggleable)
    const panel = page.locator('[data-pc-name="drawer"] [data-pc-name="panel"]')
    await expect(panel.first()).toBeVisible()

    // Cleanup
    await page.goto('/vehicles')
    await page.getByText('BMW 320d').first().click()
    await page.locator('button:has-text("Löschen")').first().click()
    await page.locator('[data-pc-name="dialog"]').getByRole('button', { name: 'Löschen' }).click()
    await expect(page.getByText('BMW 320d')).not.toBeVisible({ timeout: 5_000 })
  })
})
