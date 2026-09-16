import type { Page } from '@playwright/test'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

async function serverHasEmailReminders(page: Page, expected: boolean): Promise<void> {
  await expect.poll(() => page.evaluate(async () => {
    const { db } = (window as any).__instantdb
    const r = await db.queryOnce({ settings: {} })
    const s = (r.data.settings || [])[0]
    return s ? s.emailReminders !== false : true
  }), { timeout: 10_000 }).toBe(expected)
}

test.describe('Settings Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('SE-001: settings show subscription card in proxy mode (no API key field)', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('Einstellungen')).toBeVisible()

    // Abo-Modus: Mistral läuft über den Proxy, kein API-Key im Browser
    await expect(page.locator('.settings-card', { hasText: 'Abo & Nutzung' })).toBeVisible()
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
  })

  test('SE-005: E-Mail-Erinnerungen lassen sich abschalten und bleiben nach dem Neuladen aus', async ({ page }) => {
    await page.goto('/settings')
    const card = page.locator('.settings-card', { hasText: 'Erinnerungen' })
    const toggle = card.getByRole('switch')
    await expect(toggle).toBeChecked()
    await expect(toggle).toBeEnabled()
    await toggle.click()
    await expect(toggle).not.toBeChecked()
    // Erst neu laden, wenn der Server den Wert hat; sonst prüft der Test den Sync statt der Einstellung
    await serverHasEmailReminders(page, false)
    await page.reload()
    const reloaded = page.locator('.settings-card', { hasText: 'Erinnerungen' }).getByRole('switch')
    await expect(reloaded).toBeEnabled()
    await expect(reloaded).not.toBeChecked()
    await reloaded.click()
    await serverHasEmailReminders(page, true)
    await page.reload()
    await expect(page.locator('.settings-card', { hasText: 'Erinnerungen' }).getByRole('switch')).toBeChecked()
  })

  test('SE-003: default theme follows the system', async ({ page }) => {
    // Clear localStorage to simulate first visit; the browser prefers dark here
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/settings')
    await page.evaluate(() => localStorage.removeItem('theme'))
    await page.reload()

    // Standard ist «System»: der Browser wünscht hier dunkel, also dunkel
    await expect(page.locator('html.dark-mode')).toBeAttached()
    await expect(page.getByRole('combobox', { name: 'System' })).toBeVisible()
  })

  test('SE-004: switch theme from dark to light and back', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/settings')

    // Start: System, der Browser wünscht dunkel
    await expect(page.locator('html.dark-mode')).toBeAttached()

    // Switch to light
    await page.getByRole('combobox', { name: 'System' }).click()
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
    await page.getByRole('button', { name: 'Erweitert anzeigen' }).click()
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
