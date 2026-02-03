import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { clearInstantDB } from './fixtures/db-cleanup'

test.describe('Settings Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('SE-001: select AI provider and enter API key', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('KI-Provider')).toBeVisible()

    // Check provider dropdown is visible
    await expect(page.getByLabel('Provider')).toBeVisible()

    // Check API key input exists
    const apiKeyInput = page.getByLabel('API Key')
    await expect(apiKeyInput).toBeVisible()
  })

  test('SE-002: export and import database', async ({ page }) => {
    await page.goto('/settings')

    // Wait for InstantDB to be ready, then insert a test vehicle
    await page.waitForFunction(() => (window as any).__instantdb)
    const testVehicleId = await page.evaluate(async () => {
      const { db, tx, id: genId } = (window as any).__instantdb
      const vehicleId = genId()
      const now = Date.now()
      await db.transact([
        tx.vehicles[vehicleId].update({
          make: 'ExportTest',
          model: 'Roundtrip',
          year: 2025,
          mileage: 12345,
          licensePlate: 'EX-123',
          vin: '',
          createdAt: now,
        }),
      ])
      return vehicleId
    })

    // Click export and capture the download
    const downloadPromise = page.waitForEvent('download')
    await page.locator('.export-btn').click()
    const download = await downloadPromise
    const downloadPath = path.join(tmpdir(), `export-test-${Date.now()}.json`)
    await download.saveAs(downloadPath)

    // Delete the vehicle
    await page.evaluate(async (vId: string) => {
      const { db, tx } = (window as any).__instantdb
      await db.transact([tx.vehicles[vId].delete()])
    }, testVehicleId)

    // Verify vehicle is gone
    const gone = await page.evaluate(async (vId: string) => {
      const { db } = (window as any).__instantdb
      const result = await db.queryOnce({ vehicles: {} })
      const vehicles = result.data.vehicles || []
      return !vehicles.find((v: any) => v.id === vId)
    }, testVehicleId)
    expect(gone).toBe(true)

    // Import the file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(downloadPath)

    // Wait for import notification
    await expect(page.getByText('Import erfolgreich')).toBeVisible({ timeout: 5000 })

    // Verify vehicle is back
    const restored = await page.evaluate(async (vId: string) => {
      const { db } = (window as any).__instantdb
      const result = await db.queryOnce({ vehicles: {} })
      const vehicles = result.data.vehicles || []
      const vehicle = vehicles.find((v: any) => v.id === vId)
      return vehicle ? { make: vehicle.make, model: vehicle.model, mileage: vehicle.mileage } : null
    }, testVehicleId)
    expect(restored).toEqual({ make: 'ExportTest', model: 'Roundtrip', mileage: 12345 })

    // Cleanup: delete the test vehicle
    await page.evaluate(async (vId: string) => {
      const { db, tx } = (window as any).__instantdb
      await db.transact([tx.vehicles[vId].delete()])
    }, testVehicleId)
  })
})
