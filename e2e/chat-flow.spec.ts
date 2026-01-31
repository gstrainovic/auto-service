import { expect, test } from '@playwright/test'

test.describe('Chat Flow', () => {
  // Qwen3 on CPU takes ~1.5 min per message
  test.setTimeout(600_000)

  test('open chat and create a vehicle via tool-calling', async ({ page }) => {
    // Configure Ollama
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('ai_provider', 'ollama')
      localStorage.setItem('ollama_url', 'http://localhost:11434')
      localStorage.setItem('ollama_model', 'qwen3')
    })
    await page.reload()

    // Step 1: Open chat via FAB
    await page.getByRole('button', { name: 'chat' }).click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    // Step 2: Verify welcome message
    await expect(page.getByText('Fahrzeuge verwalten')).toBeVisible()

    // Step 3: Ask to create a vehicle
    const input = page.locator('input[placeholder="Nachricht..."]')
    await input.fill('Trage bitte einen Audi A4 Baujahr 2019 mit 62000 km und Kennzeichen B-CD 5678 ein.')
    await page.getByRole('button', { name: 'send' }).click()

    // Step 4: Wait for response (tool-calling + response)
    await expect(page.locator('.q-spinner-dots')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.q-spinner-dots')).not.toBeVisible({ timeout: 300_000 })

    // Step 5: Verify the assistant responded with confirmation
    const messages = page.locator('.q-message')
    await expect(messages.last()).toContainText(/Audi|A4|angelegt|eingetragen/i, { timeout: 10_000 })

    // Step 6: Close chat and verify the vehicle was created
    await page.getByRole('button', { name: 'close' }).click()
    await page.goto('/vehicles')
    await expect(page.getByText('Audi A4')).toBeVisible({ timeout: 10_000 })
  })
})
