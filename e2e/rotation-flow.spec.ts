import path from 'node:path'
import process from 'node:process'
import { expect, test } from '@playwright/test'
import { clearInstantDB } from './fixtures/db-cleanup'

const AI_PROVIDER = process.env.VITE_AI_PROVIDER || 'mistral'
const AI_API_KEY = process.env.VITE_AI_API_KEY || ''

test.describe('Image Rotation', () => {
  test.setTimeout(120_000)
  test.skip(AI_PROVIDER !== 'ollama' && !AI_API_KEY, 'No API key set and not using Ollama')

  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('RF-001: landscape invoice is auto-rotated to portrait on save', async ({ page }) => {
    // Step 1: Configure AI provider
    await page.goto('/')
    await page.evaluate(({ provider, key }) => {
      localStorage.setItem('ai_provider', provider)
      localStorage.setItem('ai_api_key', key)
    }, { provider: AI_PROVIDER, key: AI_API_KEY })

    // Step 2: Add a vehicle
    await page.goto('/vehicles')
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    await page.getByLabel('Marke').fill('BMW')
    await page.getByLabel('Modell').fill('320d')
    await page.getByLabel('Baujahr').fill('2020')
    await page.getByLabel('Kilometerstand').fill('45000')
    await page.getByLabel('Kennzeichen').fill('M-AB 1234')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('BMW 320d')).toBeVisible()

    // Step 3: Navigate to scan page and select vehicle
    await page.goto('/scan')
    await page.getByLabel('Fahrzeug wählen').click()
    await page.getByText('BMW 320d (M-AB 1234)').click()

    // Step 4: Upload LANDSCAPE invoice (1000x800, text sideways)
    await page.getByText('Datei').click()
    const landscapePath = path.join(import.meta.dirname, 'fixtures', 'test-invoice-landscape.png')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(landscapePath)

    // Step 5: Wait for AI parsing
    await expect(page.getByText('KI analysiert Rechnung...')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Erkannte Daten')).toBeVisible({ timeout: 60_000 })

    // Step 6: Save results
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Erkannte Daten')).not.toBeVisible({ timeout: 10_000 })

    // Step 7: Open vehicle detail and check stored image
    await page.goto('/vehicles')
    await page.getByText('BMW 320d').click()
    await page.getByRole('tab', { name: 'Rechnungen' }).click()

    // Click the invoice to open the detail dialog
    const invoiceItem = page.locator('.invoice-item').first()
    await invoiceItem.click()

    // Wait for dialog with image
    const dialog = page.locator('[data-pc-name="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    const img = dialog.locator('img')
    await expect(img).toBeVisible({ timeout: 5_000 })

    // Step 8: Verify the stored image is PORTRAIT (height > width)
    // autoRotateForDocument should have rotated the landscape image
    const dimensions = await img.evaluate((el: HTMLImageElement) => {
      return new Promise<{ w: number, h: number }>((resolve) => {
        if (el.naturalWidth > 0) {
          resolve({ w: el.naturalWidth, h: el.naturalHeight })
        }
        else {
          el.onload = () => resolve({ w: el.naturalWidth, h: el.naturalHeight })
        }
      })
    })

    expect(dimensions.h).toBeGreaterThan(dimensions.w)
  })
})
