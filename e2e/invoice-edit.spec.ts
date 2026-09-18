import type { Page } from '@playwright/test'
import { clearInstantDB, expect, test, waitForInstantDB } from './fixtures/test-fixtures'

// Rechnung bearbeiten: die Wartungen, die aus der Rechnung entstanden sind, ziehen Datum, Kilometerstand
// und Positionen mit. Sonst rechnet die Fälligkeit mit alten Werten weiter.

async function seedInvoiceWithMaintenance(page: Page): Promise<string> {
  await page.goto('/')
  await waitForInstantDB(page)
  return page.evaluate(async () => {
    const { db, tx, id: genId } = (window as any).__instantdb
    const vehicleId = genId()
    const invoiceId = genId()
    const now = new Date().toISOString()
    await db.transact([
      tx.vehicles[vehicleId].update({ make: 'Skoda', model: 'Octavia', year: 2019, mileage: 60000, licensePlate: 'SG 9', createdAt: now, updatedAt: now }),
      tx.invoices[invoiceId].update({ vehicleId, workshopName: 'Garage Kunz', date: '2025-05-02', totalAmount: 300, currency: 'CHF', mileageAtService: 58000, items: [
        { description: 'Motoröl', category: 'oelwechsel', amount: 300 },
      ], createdAt: now, updatedAt: now }),
      tx.maintenances[genId()].update({ vehicleId, invoiceId, type: 'oelwechsel', description: 'Motoröl', doneAt: '2025-05-02', mileageAtService: 58000, status: 'done', createdAt: now, updatedAt: now }),
    ])
    return vehicleId as string
  })
}

test.describe('Rechnung bearbeiten', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('IE-001: neues Datum und neuer Kilometerstand gehen an die verknüpfte Wartung', async ({ page }) => {
    const vehicleId = await seedInvoiceWithMaintenance(page)
    await page.goto(`/vehicles/${vehicleId}`)
    await page.getByRole('tab', { name: 'Rechnungen' }).click()
    await page.getByText('Garage Kunz').click()
    await page.locator('[data-pc-name="dialog"]').getByRole('button', { name: 'Bearbeiten' }).click()

    const dialog = page.locator('[data-pc-name="dialog"]', { hasText: 'Rechnung bearbeiten' })
    await dialog.locator('#invoice-date').fill('2026-03-11')
    await dialog.locator('#invoice-mileage-input').fill('67000')
    await dialog.getByRole('button', { name: 'Speichern' }).click()
    await expect(dialog).not.toBeVisible()

    // Wartung auf dem Wartungs-Tab trägt die neuen Werte
    await page.getByRole('tab', { name: 'Verlauf' }).click()
    const entry = page.locator('.maintenance-item', { hasText: 'Motoröl' })
    await expect(entry).toContainText('11.03.2026')
    await expect(entry).toContainText('67\'000 km')
    // Fahrzeug-Kilometerstand zieht nach
    await expect(page.getByText('67\'000 km').first()).toBeVisible()
  })

  test('IE-002: geänderte Positionen legen Wartungen an und entfernen weggefallene', async ({ page }) => {
    const vehicleId = await seedInvoiceWithMaintenance(page)
    await page.goto(`/vehicles/${vehicleId}`)
    await page.getByRole('tab', { name: 'Rechnungen' }).click()
    await page.getByText('Garage Kunz').click()
    await page.locator('[data-pc-name="dialog"]').getByRole('button', { name: 'Bearbeiten' }).click()

    const dialog = page.locator('[data-pc-name="dialog"]', { hasText: 'Rechnung bearbeiten' })
    const item = dialog.locator('.item-row').first()
    await item.locator('input[type="text"]').first().fill('Bremsbeläge vorne')
    await dialog.getByRole('button', { name: 'Speichern' }).click()
    await expect(dialog).not.toBeVisible()

    await page.getByRole('tab', { name: 'Verlauf' }).click()
    await expect(page.locator('.maintenance-item', { hasText: 'Bremsbeläge vorne' })).toBeVisible()
    await expect(page.locator('.maintenance-item', { hasText: 'Motoröl' })).toHaveCount(0)
  })
})
