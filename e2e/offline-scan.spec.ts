import path from 'node:path'
import { clearInstantDB, expect, mockInvoiceScan, SCAN_INVOICE, test } from './fixtures/test-fixtures'

// Offline fotografierter Beleg: kein Scan, aber gespeichert. Sobald wieder Verbindung besteht, holt die App
// den Scan nach und füllt die leeren Felder.

const photo = path.join(import.meta.dirname, 'fixtures', 'test-invoice.png')

test.describe('Beleg ohne Verbindung', () => {
  test.beforeEach(async ({ page }) => {
    await mockInvoiceScan(page)
    await clearInstantDB(page)
  })

  test('OS-001: offline gespeicherter Beleg wird nachgescannt, sobald wieder Verbindung besteht', async ({ page, context }) => {
    const vehicleId = await page.evaluate(async () => {
      const { db, tx, id: genId } = (window as any).__instantdb
      const v = genId()
      const now = new Date().toISOString()
      await db.transact([tx.vehicles[v].update({ make: 'VW', model: 'Caddy', year: 2019, mileage: 68500, licensePlate: 'SG 1', createdAt: now, updatedAt: now })])
      return v as string
    })
    await page.goto(`/vehicles/${vehicleId}`)
    await page.getByRole('tab', { name: 'Rechnungen' }).click()

    // Verbindung weg: der Scan läuft nicht, das Foto wird trotzdem übernommen
    await context.setOffline(true)
    await page.getByRole('button', { name: /rechnung.*hinzufügen/i }).click()
    const dialog = page.locator('[data-pc-name="dialog"]', { hasText: 'Neue Rechnung' })
    await dialog.locator('input[type="file"]').setInputFiles(photo)
    await expect(dialog.getByText(/Offline: Der Beleg wird gespeichert/)).toBeVisible({ timeout: 30_000 })
    await expect(dialog.locator('.image-preview img')).toBeVisible()

    // Datum von Hand, der Rest bleibt leer
    await dialog.locator('#invoice-date').fill('2026-04-02')
    await dialog.getByRole('button', { name: 'Speichern' }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.locator('.invoice-item', { hasText: 'Scan ausstehend' })).toBeVisible()

    // Wieder online: die App holt den Scan nach
    await context.setOffline(false)
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await expect(page.locator('.invoice-item', { hasText: SCAN_INVOICE.workshopName })).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.invoice-item', { hasText: 'Scan ausstehend' })).toHaveCount(0)
    // von Hand erfasstes Datum bleibt, der Betrag kommt aus dem Scan
    const item = page.locator('.invoice-item', { hasText: SCAN_INVOICE.workshopName })
    await expect(item).toContainText('02.04.2026')
    await expect(item).toContainText('1\'403.34')
  })
})
