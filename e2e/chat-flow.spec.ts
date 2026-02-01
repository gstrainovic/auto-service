import path from 'node:path'
import process from 'node:process'
import { expect, test } from '@playwright/test'

const AI_PROVIDER = process.env.VITE_AI_PROVIDER || 'mistral'
const AI_API_KEY = process.env.VITE_AI_API_KEY || ''

const fixturesDir = path.join(import.meta.dirname, 'fixtures')

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

    // Step 5: Wait for assistant response with substantial text
    const lastMsg = page.locator('.q-message').last()
    await expect(lastMsg).toContainText(/Audi/i, { timeout: 30_000 })

    // Check if model created directly or asked for confirmation
    const lastMsgText = await lastMsg.textContent() || ''
    if (!/angelegt|eingetragen|erstellt|hinzugefügt|gespeichert|erledigt/i.test(lastMsgText)) {
      // Model asked for confirmation — send "Ja, bitte eintragen"
      const chatInput = page.locator('.q-dialog input[placeholder="Nachricht..."]')
      await chatInput.fill('Ja, bitte eintragen')
      await chatInput.press('Enter')
      await expect(page.locator('.q-message')).toHaveCount(5, { timeout: 60_000 })
      const finalMsg = page.locator('.q-message').last()
      await expect(finalMsg).toContainText(/angelegt|eingetragen|erstellt|hinzugefügt|gespeichert|wurde|erledigt/i, { timeout: 30_000 })
    }

    // Step 6: Close chat and verify vehicle in UI (reads from RxDB)
    await page.locator('.q-toolbar').getByRole('button').last().click()
    await page.goto('/vehicles')
    await expect(page.getByText('Audi A4').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('B-CD 5678').first()).toBeVisible()
  })

  test('attach multiple images and see pending chips', async ({ page }) => {
    await page.goto('/')
    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    // Attach two images at once
    const fileInput = page.locator('.q-dialog input[type="file"]')
    await fileInput.setInputFiles([
      path.join(fixturesDir, 'test-invoice.png'),
      path.join(fixturesDir, 'test-kaufvertrag.png'),
    ])

    // Both chips should appear
    await expect(page.locator('.q-chip')).toHaveCount(2)
    await expect(page.getByText('test-invoice.png')).toBeVisible()
    await expect(page.getByText('test-kaufvertrag.png')).toBeVisible()
  })

  test('remove individual pending file via chip', async ({ page }) => {
    await page.goto('/')
    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    // Attach two images
    const fileInput = page.locator('.q-dialog input[type="file"]')
    await fileInput.setInputFiles([
      path.join(fixturesDir, 'test-invoice.png'),
      path.join(fixturesDir, 'test-kaufvertrag.png'),
    ])
    await expect(page.locator('.q-chip')).toHaveCount(2)

    // Remove the first chip
    await page.locator('.q-chip').first().getByRole('button').click()
    await expect(page.locator('.q-chip')).toHaveCount(1)
    await expect(page.getByText('test-kaufvertrag.png')).toBeVisible()
  })

  test('send multiple images shows thumbnail grid in message', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(({ provider, key }) => {
      localStorage.setItem('ai_provider', provider)
      localStorage.setItem('ai_api_key', key)
    }, { provider: AI_PROVIDER, key: AI_API_KEY })
    await page.reload()

    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    // Attach two images
    const fileInput = page.locator('.q-dialog input[type="file"]')
    await fileInput.setInputFiles([
      path.join(fixturesDir, 'test-invoice.png'),
      path.join(fixturesDir, 'test-kaufvertrag.png'),
    ])
    await expect(page.locator('.q-chip')).toHaveCount(2)

    // Type a message and send
    const input = page.locator('input[placeholder="Nachricht..."]')
    await input.fill('Was siehst du auf diesen beiden Bildern?')
    await page.locator('.q-dialog button.bg-primary').last().click()

    // Pending chips should be gone after sending
    await expect(page.locator('.q-chip')).toHaveCount(0)

    // User message should show two thumbnail images (120px grid)
    const userMsg = page.locator('.q-message', { hasText: 'Was siehst du' })
    await expect(userMsg.locator('img')).toHaveCount(2)

    // Wait for AI response
    await expect(page.locator('.q-message')).toHaveCount(3, { timeout: 60_000 })
    const assistantMsg = page.locator('.q-message').last()
    await expect(assistantMsg).toContainText(/.+/, { timeout: 10_000 })
  })
})
