import { tmpdir } from 'node:os'
import path from 'node:path'
import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

test.describe('Settings Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('SE-001: select AI provider and enter API key', async ({ page }) => {
    // This test doesn't create persistent data - no cleanup needed
    await page.goto('/settings')
    await expect(page.getByText('KI-Provider')).toBeVisible()

    // Check provider dropdown is visible (PrimeVue Select renders as combobox)
    await expect(page.getByRole('combobox').first()).toBeVisible()

    // Check API key input exists (password type input)
    const apiKeyInput = page.locator('input[type="password"]')
    await expect(apiKeyInput).toBeVisible()
  })

  test('SE-003: default theme is dark', async ({ page }) => {
    // Clear localStorage to simulate first visit
    await page.goto('/settings')
    await page.evaluate(() => localStorage.removeItem('theme'))
    await page.reload()

    // HTML should have dark-mode class by default
    await expect(page.locator('html.dark-mode')).toBeAttached()

    // Settings dropdown should show "Dunkel"
    await expect(page.getByRole('combobox', { name: 'Dunkel' })).toBeVisible()
  })

  test('SE-004: switch theme from dark to light and back', async ({ page }) => {
    await page.goto('/settings')

    // Start in dark mode
    await expect(page.locator('html.dark-mode')).toBeAttached()

    // Switch to light
    await page.getByRole('combobox', { name: 'Dunkel' }).click()
    await page.getByRole('option', { name: 'Hell' }).click()
    await expect(page.locator('html.dark-mode')).not.toBeAttached()

    // Verify persisted in localStorage
    const storedTheme = await page.evaluate(() => localStorage.getItem('theme'))
    expect(storedTheme).toBe('light')

    // Switch back to dark
    await page.getByRole('combobox', { name: 'Hell' }).click()
    await page.getByRole('option', { name: 'Dunkel' }).click()
    await expect(page.locator('html.dark-mode')).toBeAttached()
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

    // Import the file using filechooser API
    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Daten importieren' }).click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(downloadPath)

    // Wait for import to complete by checking the data directly (more reliable than toast)
    await page.waitForFunction(async (vId: string) => {
      const { db } = (window as any).__instantdb
      const result = await db.queryOnce({ vehicles: {} })
      const vehicles = result.data.vehicles || []
      return vehicles.some((v: any) => v.id === vId)
    }, testVehicleId, { timeout: 10000 })

    // Verify vehicle is back
    const restored = await page.evaluate(async (vId: string) => {
      const { db } = (window as any).__instantdb
      const result = await db.queryOnce({ vehicles: {} })
      const vehicles = result.data.vehicles || []
      const vehicle = vehicles.find((v: any) => v.id === vId)
      return vehicle ? { make: vehicle.make, model: vehicle.model, mileage: vehicle.mileage } : null
    }, testVehicleId)
    expect(restored).toEqual({ make: 'ExportTest', model: 'Roundtrip', mileage: 12345 })

    // DELETE (cleanup)
    await page.evaluate(async (vId: string) => {
      const { db, tx } = (window as any).__instantdb
      await db.transact([tx.vehicles[vId].delete()])
    }, testVehicleId)
  })
})
