import path from 'node:path'
import process from 'node:process'
import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

const AI_PROVIDER = process.env.VITE_AI_PROVIDER || 'mistral'
const AI_API_KEY = process.env.VITE_AI_API_KEY || ''

test.describe('MediaViewer', () => {
  test.setTimeout(120_000)
  test.skip(AI_PROVIDER !== 'ollama' && !AI_API_KEY, 'No API key set and not using Ollama')

  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('MV-001: shows optimization hint after invoice scan', async ({ page }) => {
    // Configure AI provider
    await page.goto('/')
    await page.evaluate(({ provider, key }) => {
      localStorage.setItem('ai_provider', provider)
      localStorage.setItem('ai_api_key', key)
    }, { provider: AI_PROVIDER, key: AI_API_KEY })

    // Add a vehicle
    await page.goto('/vehicles')
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    await page.getByLabel('Marke').fill('Test')
    await page.getByLabel('Modell').fill('MediaViewer')
    await page.getByLabel('Baujahr').fill('2023')
    await page.getByLabel('Kilometerstand').fill('10000')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Test MediaViewer')).toBeVisible()

    // Scan an invoice
    await page.goto('/scan')
    await page.getByLabel('Fahrzeug wählen').click()
    await page.getByText('Test MediaViewer').click()
    await page.getByText('Datei').click()

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(import.meta.dirname, 'fixtures', 'test-invoice.png'))

    // Wait for AI analysis
    await expect(page.getByText('KI analysiert Rechnung...')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Erkannte Daten')).toBeVisible({ timeout: 60_000 })

    // Save the invoice
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Erkannte Daten')).not.toBeVisible({ timeout: 10_000 })

    // Open vehicle detail → invoices
    await page.goto('/vehicles')
    await page.getByText('Test MediaViewer').click()
    await page.getByRole('tab', { name: 'Rechnungen' }).click()

    // Click invoice to open detail dialog
    const invoiceItem = page.locator('.invoice-item').first()
    await invoiceItem.click()

    const dialog = page.locator('[data-pc-name="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    // Click image to open MediaViewer
    const img = dialog.locator('img')
    await expect(img).toBeVisible({ timeout: 5_000 })
    await img.click()

    // Verify optimization hint is visible
    await expect(page.getByText('automatisch optimiert')).toBeVisible({ timeout: 5_000 })

    // Close MediaViewer (press Escape) - this may also close the dialog
    await page.keyboard.press('Escape')

    // Wait a moment for any animations
    await page.waitForTimeout(300)

    // DELETE (cleanup) - use the header delete button (has visible text, not icon-only)
    await page.locator('button:has-text("Löschen")').first().click()
    await page.locator('[data-pc-name="dialog"]').getByRole('button', { name: 'Löschen' }).click()
    await expect(page.getByText('Test MediaViewer')).not.toBeVisible({ timeout: 5_000 })
  })

  test('MV-002: chat image shows OCR tab in MediaViewer', async ({ page }) => {
    test.skip(AI_PROVIDER !== 'mistral', 'OCR cache only available with Mistral provider')

    // Capture browser console logs
    page.on('console', msg => console.warn('[BROWSER]', msg.type(), msg.text()))

    // Configure AI provider
    await page.goto('/')
    await page.evaluate(({ provider, key }) => {
      localStorage.setItem('ai_provider', provider)
      localStorage.setItem('ai_api_key', key)
    }, { provider: AI_PROVIDER, key: AI_API_KEY })
    await page.reload()

    // Open chat
    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    // Attach image and send
    const fileInput = page.locator('[data-pc-name="drawer"] input[type="file"]').first()
    await fileInput.setInputFiles(path.join(import.meta.dirname, 'fixtures', 'test-invoice.png'))
    await expect(page.locator('[data-pc-name="chip"]')).toHaveCount(1, { timeout: 10_000 })

    const input = page.locator('[placeholder="Nachricht..."]')
    await input.fill('Was steht auf dieser Rechnung?')
    await page.locator('[data-pc-name="drawer"] button').filter({ has: page.locator('.pi-send') }).click()

    // Wait for AI response (OCR + tool-calling takes time)
    await expect(page.locator('.chat-message')).toHaveCount(3, { timeout: 60_000 })
    // Ensure assistant message has content (OCR cache write should be complete by now)
    const assistantMsg = page.locator('.chat-message').last()
    await expect(assistantMsg).toContainText(/.+/, { timeout: 10_000 })

    // Wait for OCR cache to be written - poll until cache is populated
    const ocrCacheFound = await page.evaluate(async () => {
      for (let i = 0; i < 60; i++) {
        try {
          const idb = (window as any).__instantdb
          if (idb) {
            const result = await idb.db.queryOnce({ ocrcache: {} })
            const docs = result.data.ocrcache || []
            if (docs.length > 0)
              return { found: true, count: docs.length, ids: docs.map((d: any) => d.id) }
          }
        }
        catch (e) {
          console.error('OCR cache query error:', e)
        }
        await new Promise(r => setTimeout(r, 500))
      }
      return { found: false, count: 0, ids: [] }
    })
    console.warn('OCR cache status:', JSON.stringify(ocrCacheFound))
    expect(ocrCacheFound.found, 'OCR cache should have been written by chat flow').toBe(true)

    // Click the image thumbnail to open MediaViewer
    const userMsg = page.locator('.chat-message').nth(1)
    const thumbnail = userMsg.locator('img')
    await expect(thumbnail).toBeVisible({ timeout: 5_000 })
    await thumbnail.click()

    // Verify OCR tab is present (chat flow persists OCR to RxDB via callMistralOcr)

    await expect(page.getByText('OCR-Text')).toBeVisible({ timeout: 10_000 })

    // Verify optimization hint
    await expect(page.getByText('automatisch optimiert')).toBeVisible({ timeout: 5_000 })

    // Close MediaViewer
    await page.keyboard.press('Escape')

    // No persistent data created - no cleanup needed
  })
})
