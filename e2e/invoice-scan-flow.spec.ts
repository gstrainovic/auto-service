import path from 'node:path'
import process from 'node:process'
import { expect, test } from '@playwright/test'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

test.describe('Invoice Scan Flow', () => {
  test.setTimeout(120_000)
  test.skip(!OPENROUTER_API_KEY, 'OPENROUTER_API_KEY not set')

  test('scan a workshop invoice with AI and save results', async ({ page }) => {
    // Step 1: Configure OpenRouter
    await page.goto('/')
    await page.evaluate((key) => {
      localStorage.setItem('ai_provider', 'openrouter')
      localStorage.setItem('ai_api_key', key)
    }, OPENROUTER_API_KEY!)

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
    await expect(page.getByRole('heading', { name: 'Dokument scannen' })).toBeVisible()

    await page.getByLabel('Fahrzeug wählen').click()
    await page.getByText('BMW 320d (M-AB 1234)').click()

    // Step 4: Switch to file mode and upload the test invoice image
    await page.getByText('Datei').click()

    const invoicePath = path.join(import.meta.dirname, 'fixtures', 'test-invoice.png')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(invoicePath)

    // Step 5: Wait for AI parsing
    await expect(page.getByText('KI analysiert Rechnung...')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Erkannte Daten')).toBeVisible({ timeout: 60_000 })

    // Step 6: Verify parsed data
    const resultCard = page.locator('.q-card', { hasText: 'Erkannte Daten' })
    await expect(resultCard.getByText(/München/)).toBeVisible()
    await expect(resultCard.getByText('Positionen')).toBeVisible()

    const items = resultCard.locator('.q-item')
    await expect(items.first()).toBeVisible()
    expect(await items.count()).toBeGreaterThanOrEqual(1)

    // Step 7: Save the results
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Erkannte Daten')).not.toBeVisible({ timeout: 10_000 })

    // Step 8: Verify invoice saved to vehicle
    await page.goto('/vehicles')
    await page.getByText('BMW 320d').click()
    await page.getByText('Rechnungen').click()
    await expect(page.locator('.q-tab-panel').getByText(/München/)).toBeVisible({ timeout: 10_000 })

    // Step 9: Verify dashboard shows maintenance status
    await page.goto('/')
    await expect(page.getByText('BMW 320d')).toBeVisible()

    const mainSection = page.locator('main')
    await expect(mainSection.getByText('Ölwechsel')).toBeVisible({ timeout: 10_000 })
    await expect(mainSection.getByText(/Zuletzt:/).first()).toBeVisible()
  })
})
