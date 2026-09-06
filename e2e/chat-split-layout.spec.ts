import process from 'node:process'
import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

const AI_API_KEY = process.env.VITE_AI_API_KEY || ''

test.describe('Chat Split Layout', () => {
  test.setTimeout(120_000)
  test.skip(!AI_API_KEY, 'No API key set')

  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('SL-001: maximized chat with tool results shows 30/70 split layout', async ({ page }) => {
    // Configure Mistral API key
    await page.goto('/')
    await page.evaluate(({ key }) => {
      localStorage.setItem('ai_api_key', key)
    }, { key: AI_API_KEY })
    await page.reload()

    // Open chat
    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    // Create a vehicle via chat to get a tool result
    const input = page.locator('[data-pc-name="drawer"]').getByPlaceholder('Nachricht...')
    await input.fill('Erstelle ein Fahrzeug: Audi Q5 Baujahr 2022 mit 30000 km')
    await page.locator('[data-pc-name="drawer"]').locator('.chat-fab-send').click()

    // Wait for AI response
    await expect(page.locator('.chat-message:not(.chat-message-loading)')).toHaveCount(3, { timeout: 60_000 })

    // If AI asks for confirmation, confirm
    const lastMsg = page.locator('.chat-message-assistant:not(.chat-message-loading)').last()
    const text = await lastMsg.textContent() || ''
    if (!/angelegt|erstellt|gespeichert|erledigt/i.test(text)) {
      await input.fill('Ja, bitte eintragen')
      await input.press('Enter')
      await expect(page.locator('.chat-message:not(.chat-message-loading)')).toHaveCount(5, { timeout: 60_000 })
    }

    // Tool result card should be visible inline (not maximized yet)
    const toolCard = page.locator('[data-pc-name="drawer"] .tool-result-card')
    await expect(toolCard.first()).toBeVisible({ timeout: 10_000 })

    // No split layout in drawer mode
    await expect(page.locator('.chat-split-layout')).not.toBeVisible()

    // Maximize chat
    await page.locator('.chat-maximize-btn').click()
    await expect(page.locator('.chat-maximized')).toBeVisible()

    // Split layout should appear with cards panel and main panel
    const splitLayout = page.locator('.chat-split-layout')
    await expect(splitLayout).toBeVisible({ timeout: 5_000 })

    const cardsPanel = page.locator('.chat-cards-panel')
    await expect(cardsPanel).toBeVisible()

    const mainPanel = page.locator('.chat-main-panel')
    await expect(mainPanel).toBeVisible()

    // Cards panel should contain the tool result card
    await expect(cardsPanel.locator('.tool-result-card').first()).toBeVisible()
    await expect(cardsPanel.locator('.tool-result-card')).toContainText([/Audi/i])

    // Chat messages should still be visible in main panel
    await expect(mainPanel.locator('.chat-message:not(.chat-message-loading)').first()).toBeVisible()

    // Minimize — split should disappear
    await page.locator('.chat-maximize-btn').click()
    await expect(page.locator('.chat-split-layout')).not.toBeVisible()

    // Cleanup
    await page.goto('/vehicles')
    await page.getByText('Audi Q5').first().click()
    await page.locator('button:has-text("Löschen")').first().click()
    await page.locator('[data-pc-name="dialog"]').getByRole('button', { name: 'Löschen' }).click()
    await expect(page.getByText('Audi Q5')).not.toBeVisible({ timeout: 5_000 })
  })
})
