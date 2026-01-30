import path from 'node:path'
import process from 'node:process'
import { expect, test } from '@playwright/test'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

test.describe('Invoice Scan Flow', () => {
  test.skip(!GEMINI_API_KEY, 'GEMINI_API_KEY not set')

  test('scan a workshop invoice with AI and save results', async ({ page }) => {
    // Step 1: Set API key in settings via localStorage (faster than navigating)
    await page.goto('/')
    await page.evaluate((key) => {
      localStorage.setItem('ai_provider', 'google')
      localStorage.setItem('ai_api_key', key)
    }, GEMINI_API_KEY!)

    // Step 2: Add a vehicle
    await page.goto('/vehicles')
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    await page.getByLabel('Marke').fill('BMW')
    await page.getByLabel('Modell').fill('320d')
    await page.getByLabel('Baujahr').fill('2020')
    await page.getByLabel('Kilometerstand').fill('45000')
    await page.getByLabel('Kennzeichen').fill('M-AB 1234')
    await page.getByRole('button', { name: 'Fahrzeug speichern' }).click()
    await expect(page.getByText('BMW 320d')).toBeVisible()

    // Step 3: Go to scan page and select the vehicle
    await page.goto('/scan')
    await expect(page.getByRole('heading', { name: 'Rechnung scannen' })).toBeVisible()

    // Select vehicle from Quasar QSelect
    await page.getByLabel('Fahrzeug wählen').click()
    await page.getByText('BMW 320d (M-AB 1234)').click()

    // Step 4: Switch to file mode and upload the test invoice image
    await page.getByText('Datei').click()

    const invoicePath = path.join(import.meta.dirname, 'fixtures', 'test-invoice.png')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(invoicePath)

    // Step 5: Wait for AI parsing indicator
    await expect(page.getByText('KI analysiert Rechnung...')).toBeVisible({ timeout: 10_000 })

    // Wait for results to appear (API call can take 10-30 seconds)
    await expect(page.getByText('Erkannte Daten')).toBeVisible({ timeout: 60_000 })

    // Step 6: Verify parsed data contains expected information
    const resultCard = page.locator('.q-card', { hasText: 'Erkannte Daten' })

    // Workshop name should be recognized (AI may vary slightly)
    await expect(resultCard.getByText(/München/)).toBeVisible()

    // Should have line items section
    await expect(resultCard.getByText('Positionen')).toBeVisible()

    // Should have at least one line item visible
    const items = resultCard.locator('.q-item')
    await expect(items.first()).toBeVisible()
    const itemCount = await items.count()
    expect(itemCount).toBeGreaterThanOrEqual(2)

    // Step 7: Save the results
    await page.getByRole('button', { name: 'Speichern' }).click()

    // After saving, the result card should disappear
    await expect(page.getByText('Erkannte Daten')).not.toBeVisible({ timeout: 10_000 })

    // Step 8: Verify vehicle detail page has the invoice
    await page.goto('/vehicles')
    await page.getByText('BMW 320d').click()

    // Switch to invoices tab
    await page.getByText('Rechnungen').click()

    // Should show the saved invoice with workshop name
    await expect(page.locator('.q-tab-panel').getByText(/München/)).toBeVisible({ timeout: 10_000 })
  })
})
