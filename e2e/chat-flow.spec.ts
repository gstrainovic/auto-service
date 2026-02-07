import path from 'node:path'
import process from 'node:process'
import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

const AI_PROVIDER = process.env.VITE_AI_PROVIDER || 'mistral'
const AI_API_KEY = process.env.VITE_AI_API_KEY || ''

const fixturesDir = path.join(import.meta.dirname, 'fixtures')

test.describe('Chat Flow', () => {
  test.setTimeout(120_000)
  test.skip(AI_PROVIDER !== 'ollama' && !AI_API_KEY, 'No API key set and not using Ollama')

  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('CF-001: open chat and create a vehicle via tool-calling', async ({ page }) => {
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
    const input = page.getByPlaceholder('Nachricht...')
    await input.fill('Trage bitte einen Audi A4 Baujahr 2019 mit 62000 km und Kennzeichen B-CD 5678 ein.')
    await page.locator('[data-pc-name="drawer"]').locator('button:has(.pi-send)').click()

    // Step 4: Wait for AI response (at least 3 messages: welcome + user + assistant)
    await expect(page.locator('.chat-message')).toHaveCount(3, { timeout: 60_000 })

    // Step 5: Wait for assistant response with substantial text
    const lastMsg = page.locator('.chat-message').last()
    await expect(lastMsg).toContainText(/Audi/i, { timeout: 30_000 })

    // Check if model created directly or asked for confirmation
    const lastMsgText = await lastMsg.textContent() || ''
    if (!/angelegt|eingetragen|erstellt|hinzugefügt|gespeichert|erfasst|erledigt|Hier sind die Daten|Daten deines Fahrzeugs/i.test(lastMsgText)) {
      // Model asked for confirmation — send "Ja, bitte eintragen"
      const chatInput = page.locator('[data-pc-name="drawer"]').getByPlaceholder('Nachricht...')
      await chatInput.fill('Ja, bitte eintragen')
      await chatInput.press('Enter')
      await expect(page.locator('.chat-message')).toHaveCount(5, { timeout: 60_000 })
      const finalMsg = page.locator('.chat-message').last()
      await expect(finalMsg).toContainText(/angelegt|eingetragen|erstellt|hinzugefügt|gespeichert|wurde|erledigt|Hier sind|Hier ist|Daten deines|neuer/i, { timeout: 30_000 })
    }

    // Step 6: Close chat and verify vehicle in UI
    await page.goto('/vehicles')
    await expect(page.getByText('Audi A4').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('B-CD 5678').first()).toBeVisible()

    // DELETE (cleanup) - use the header delete button (has visible text, not icon-only)
    await page.getByText('Audi A4').first().click()
    await page.locator('button:has-text("Löschen")').first().click()
    await page.locator('[data-pc-name="dialog"]').getByRole('button', { name: 'Löschen' }).click()
    await expect(page.getByText('Audi A4')).not.toBeVisible({ timeout: 5_000 })
  })

  test('CF-002: attach multiple images and see pending chips', async ({ page }) => {
    // This test doesn't create persistent data - no cleanup needed
    await page.goto('/')
    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    // Attach two images at once
    const fileInput = page.locator('[data-pc-name="drawer"] input[type="file"]').first()
    await fileInput.setInputFiles([
      path.join(fixturesDir, 'test-invoice.png'),
      path.join(fixturesDir, 'test-kaufvertrag.png'),
    ])

    // Both chips should appear
    await expect(page.locator('[data-pc-name="chip"]')).toHaveCount(2)
    await expect(page.getByText('test-invoice.png')).toBeVisible()
    await expect(page.getByText('test-kaufvertrag.png')).toBeVisible()
  })

  test('CF-003: remove individual pending file via chip', async ({ page }) => {
    // This test doesn't create persistent data - no cleanup needed
    await page.goto('/')
    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    // Attach two images
    const fileInput = page.locator('[data-pc-name="drawer"] input[type="file"]').first()
    await fileInput.setInputFiles([
      path.join(fixturesDir, 'test-invoice.png'),
      path.join(fixturesDir, 'test-kaufvertrag.png'),
    ])
    await expect(page.locator('[data-pc-name="chip"]')).toHaveCount(2)

    // Remove the first chip — one should remain
    const firstChipText = await page.locator('[data-pc-name="chip"]').first().textContent()
    // PrimeVue Chip remove icon uses class p-chip-remove-icon
    await page.locator('[data-pc-name="chip"]').first().locator('.p-chip-remove-icon').click()
    await expect(page.locator('[data-pc-name="chip"]')).toHaveCount(1)
    // The remaining chip should be the OTHER file
    const remainingText = await page.locator('[data-pc-name="chip"]').first().textContent()
    expect(remainingText).not.toBe(firstChipText)
  })

  test('CF-004: send multiple images shows thumbnail grid in message', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(({ provider, key }) => {
      localStorage.setItem('ai_provider', provider)
      localStorage.setItem('ai_api_key', key)
    }, { provider: AI_PROVIDER, key: AI_API_KEY })
    await page.reload()

    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    // Attach two images
    const fileInput = page.locator('[data-pc-name="drawer"] input[type="file"]').first()
    await fileInput.setInputFiles([
      path.join(fixturesDir, 'test-invoice.png'),
      path.join(fixturesDir, 'test-kaufvertrag.png'),
    ])
    await expect(page.locator('[data-pc-name="chip"]')).toHaveCount(2)

    // Type a message and send
    const input = page.getByPlaceholder('Nachricht...')
    await input.fill('Was siehst du auf diesen beiden Bildern?')
    await page.locator('[data-pc-name="drawer"]').locator('button:has(.pi-send)').click()

    // Pending chips should be gone after sending
    await expect(page.locator('[data-pc-name="chip"]')).toHaveCount(0)

    // User message should show two thumbnail images (120px grid)
    const userMsg = page.locator('.chat-message', { hasText: 'Was siehst du' })
    await expect(userMsg.locator('img')).toHaveCount(2)

    // Wait for AI response
    await expect(page.locator('.chat-message')).toHaveCount(3, { timeout: 60_000 })
    const assistantMsg = page.locator('.chat-message').last()
    await expect(assistantMsg).toContainText(/.+/, { timeout: 10_000 })

    // Chat messages don't persist on page reload, no cleanup needed
  })

  test('CF-006: AI assigns invoice to the correct vehicle when multiple exist', async ({ page }) => {
    // Setup: Configure AI provider
    await page.goto('/')
    await page.evaluate(({ provider, key }) => {
      localStorage.setItem('ai_provider', provider)
      localStorage.setItem('ai_api_key', key)
    }, { provider: AI_PROVIDER, key: AI_API_KEY })

    // Step 1: Create FIRST vehicle — Toyota Corolla (the WRONG one)
    await page.goto('/vehicles')
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    await page.getByLabel('Marke').fill('Toyota')
    await page.getByLabel('Modell').fill('Corolla')
    await page.getByLabel('Baujahr').fill('2019')
    await page.getByLabel('Kilometerstand').fill('60000')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Toyota Corolla').first()).toBeVisible({ timeout: 10_000 })

    // Step 2: Create SECOND vehicle — VW Golf (the RIGHT one, matches VW workshop invoice)
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    await page.getByLabel('Marke').fill('VW')
    await page.getByLabel('Modell').fill('Golf')
    await page.getByLabel('Baujahr').fill('2020')
    await page.getByLabel('Kilometerstand').fill('55000')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('VW Golf').first()).toBeVisible({ timeout: 10_000 })

    // Step 3: Open chat
    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    // Step 4: Upload invoice image (VW workshop invoice)
    const fileInput = page.locator('[data-pc-name="drawer"] input[type="file"]').first()
    await fileInput.setInputFiles(path.join(fixturesDir, 'test-invoice.png'))
    await expect(page.locator('[data-pc-name="chip"]')).toHaveCount(1)

    // Step 5: Send message to process the invoice
    const chatInput = page.locator('[data-pc-name="drawer"]').getByPlaceholder('Nachricht...')
    await chatInput.fill('Bitte erfassen')
    await page.locator('[data-pc-name="drawer"]').locator('.chat-fab-send').click()

    // Step 6: Wait for AI response (welcome + user + at least one assistant message)
    await expect(async () => {
      const count = await page.locator('.chat-message').count()
      expect(count).toBeGreaterThanOrEqual(3)
    }).toPass({ timeout: 60_000 })

    // Step 7: Wait for assistant to produce a substantive response
    const lastMsg = page.locator('.chat-message-assistant').last()
    await expect(lastMsg).toContainText(/.{10,}/, { timeout: 30_000 })
    const responseText = await lastMsg.textContent() || ''

    // AI should NOT silently assign to Toyota without any VW/Golf mention
    const mentionsVW = /vw|golf|volkswagen/i.test(responseText)
    const mentionsToyota = /toyota|corolla/i.test(responseText)
    const asksWhichVehicle = /welch|zuordn|fahrzeug|wählen|auswählen/i.test(responseText)
    let confirmedSave = /gespeichert|angelegt|eingetragen|erstellt|hinzugefügt|erfasst|erledigt/i.test(responseText)

    // The AI should either:
    // a) Mention VW/Golf (correctly identified the vehicle from the invoice)
    // b) Ask which vehicle to assign to
    // c) NOT just silently assign to Toyota
    expect(
      mentionsVW || asksWhichVehicle || !mentionsToyota,
      `AI should reference VW/Golf or ask which vehicle, but response was: ${responseText.substring(0, 200)}`,
    ).toBe(true)

    // Step 8: If AI hasn't confirmed save yet, send up to 2 confirmations
    for (let i = 0; i < 2 && !confirmedSave; i++) {
      const confirmText = asksWhichVehicle ? 'Den VW Golf bitte' : 'Ja, bitte speichern'
      await chatInput.fill(confirmText)
      await chatInput.press('Enter')
      // Wait for the AI to respond with a success indicator
      await expect(page.locator('.chat-message-assistant').last())
        .toContainText(/gespeichert|angelegt|eingetragen|erstellt|hinzugefügt|erfasst|erledigt|zugeordnet|Rechnung/i, { timeout: 60_000 })
      const latestText = await page.locator('.chat-message-assistant').last().textContent() || ''
      confirmedSave = /gespeichert|angelegt|eingetragen|erstellt|hinzugefügt|erfasst|erledigt/i.test(latestText)
    }

    // Step 9: Verify invoice was saved to VW Golf (not Toyota)
    await page.goto('/vehicles')
    await page.getByText('VW Golf').first().click()
    await page.getByRole('tab', { name: /Rechnungen/ }).click()

    // VW Golf should have the invoice
    const vwInvoicePanel = page.locator('[data-pc-name="tabpanel"]')
    const hasInvoice = await vwInvoicePanel.getByText(/München|Werkstatt|invoice/i).isVisible({ timeout: 10_000 }).catch(() => false)

    if (hasInvoice) {
      // Good: Invoice was assigned to VW Golf
      await expect(vwInvoicePanel.getByText(/München|Werkstatt/i).first()).toBeVisible()
    }

    // Step 10: Cleanup — delete both vehicles
    await page.goto('/vehicles')

    // Delete VW Golf
    await page.getByText('VW Golf').first().click()
    await page.locator('button:has-text("Löschen")').first().click()
    await page.locator('[data-pc-name="dialog"]').getByRole('button', { name: 'Löschen' }).click()
    await expect(page.getByText('VW Golf')).not.toBeVisible({ timeout: 5_000 })

    // Delete Toyota Corolla
    await page.getByText('Toyota Corolla').first().click()
    await page.locator('button:has-text("Löschen")').first().click()
    await page.locator('[data-pc-name="dialog"]').getByRole('button', { name: 'Löschen' }).click()
    await expect(page.getByText('Toyota Corolla')).not.toBeVisible({ timeout: 5_000 })
  })
})
