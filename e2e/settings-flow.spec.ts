import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const __dirname = `${dirname(fileURLToPath(import.meta.url))}/`

test.describe('Settings Flow', () => {
  test('select AI provider and enter API key', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('KI-Provider')).toBeVisible()

    // Check provider dropdown is visible
    await expect(page.getByLabel('Provider')).toBeVisible()

    // Check API key input exists
    const apiKeyInput = page.getByLabel('API Key')
    await expect(apiKeyInput).toBeVisible()
  })

  test('export and import database', async ({ page }) => {
    await page.goto('/settings')

    // Wait for DB to be ready, then insert a test vehicle
    await page.waitForFunction(() => (window as any).__rxdb)
    await page.evaluate(async () => {
      const db = (window as any).__rxdb
      await db.vehicles.insert({
        id: 'test-export-vehicle',
        make: 'ExportTest',
        model: 'Roundtrip',
        year: 2025,
        mileage: 12345,
        licensePlate: 'EX-123',
        vin: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    })

    // Click export and capture the download
    const downloadPromise = page.waitForEvent('download')
    await page.locator('.export-btn').click()
    const download = await downloadPromise
    const downloadPath = `${__dirname}fixtures/export-test.json`
    await download.saveAs(downloadPath)

    // Delete the vehicle
    await page.evaluate(async () => {
      const db = (window as any).__rxdb
      const doc = await db.vehicles.findOne({ selector: { id: 'test-export-vehicle' } }).exec()
      if (doc)
        await doc.remove()
    })

    // Verify vehicle is gone
    const gone = await page.evaluate(async () => {
      const db = (window as any).__rxdb
      const doc = await db.vehicles.findOne({ selector: { id: 'test-export-vehicle' } }).exec()
      return doc === null
    })
    expect(gone).toBe(true)

    // Import the file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(downloadPath)

    // Wait for import notification
    await expect(page.getByText('Import erfolgreich')).toBeVisible({ timeout: 5000 })

    // Verify vehicle is back
    const restored = await page.evaluate(async () => {
      const db = (window as any).__rxdb
      const doc = await db.vehicles.findOne({ selector: { id: 'test-export-vehicle' } }).exec()
      return doc ? { make: doc.make, model: doc.model, mileage: doc.mileage } : null
    })
    expect(restored).toEqual({ make: 'ExportTest', model: 'Roundtrip', mileage: 12345 })

    // Cleanup: delete the test vehicle
    await page.evaluate(async () => {
      const db = (window as any).__rxdb
      const doc = await db.vehicles.findOne({ selector: { id: 'test-export-vehicle' } }).exec()
      if (doc)
        await doc.remove()
    })
  })
})
