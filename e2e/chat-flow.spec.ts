import process from 'node:process'
import { expect, test } from '@playwright/test'

const AI_PROVIDER = process.env.AI_PROVIDER || 'openrouter'
const AI_API_KEY = process.env[`${AI_PROVIDER.toUpperCase().replace('-', '_')}_API_KEY`]
  || process.env.OPENROUTER_API_KEY || ''

test.describe('Chat Flow', () => {
  test.setTimeout(120_000)
  test.skip(AI_PROVIDER !== 'ollama' && !AI_API_KEY, 'No API key set and not using Ollama')

  test('open chat and create a vehicle via tool-calling', async ({ page }) => {
    // Configure AI provider
    await page.goto('/')
    await page.evaluate(({ provider, key }) => {
      localStorage.setItem('ai_provider', provider)
      localStorage.setItem('ai_api_key', key)
    }, { provider: AI_PROVIDER, key: AI_API_KEY })
    await page.reload()

    // Step 1: Open chat via FAB
    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    // Step 2: Verify welcome message
    await expect(page.getByText('Fahrzeuge verwalten')).toBeVisible()

    // Step 3: Ask to create a vehicle
    const input = page.locator('input[placeholder="Nachricht..."]')
    await input.fill('Trage bitte einen Audi A4 Baujahr 2019 mit 62000 km und Kennzeichen B-CD 5678 ein.')
    await page.locator('.q-dialog button.bg-primary').last().click()

    // Step 4: Wait for AI response (at least 3 messages: welcome + user + assistant)
    await expect(page.locator('.q-message')).toHaveCount(3, { timeout: 60_000 })

    // Step 5: Verify the assistant responded
    const lastMsg = page.locator('.q-message').last()
    await expect(lastMsg).toContainText(/Audi|A4|angelegt|eingetragen|erstellt|hinzugefügt|Erledigt/i, { timeout: 10_000 })

    // Step 6: Close chat and verify the vehicle was created
    await page.locator('.q-toolbar').getByRole('button').last().click()
    await page.goto('/vehicles')
    await expect(page.getByText('Audi A4').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('B-CD 5678').first()).toBeVisible()
  })
})
