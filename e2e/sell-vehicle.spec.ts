import type { Page } from '@playwright/test'
import { clearInstantDB, countEntities, expect, test } from './fixtures/test-fixtures'

// Verkauft oder abgegeben statt gelöscht: raus aus Fälligkeiten und Erinnerungen, drin in Kosten und Belegen.

async function seedVehicleWithCosts(page: Page): Promise<string> {
  await page.goto('/')
  await page.waitForFunction(() => !!(window as any).__instantdb, { timeout: 30_000 })
  return page.evaluate(async () => {
    const { db, tx, id: genId } = (window as any).__instantdb
    const vehicleId = genId()
    const now = new Date().toISOString()
    const overdue = new Date(Date.now() - 3 * 365 * 86_400_000).toISOString().slice(0, 10)
    await db.transact([
      tx.vehicles[vehicleId].update({ make: 'Fiat', model: 'Ducato', year: 2018, mileage: 187000, licensePlate: 'SG 3', createdAt: now, updatedAt: now }),
      tx.invoices[genId()].update({ vehicleId, workshopName: 'Garage Muster', date: '2025-08-01', totalAmount: 640, currency: 'CHF', items: [{ description: 'Service', category: 'inspektion', amount: 640 }], createdAt: now, updatedAt: now }),
      tx.maintenances[genId()].update({ vehicleId, type: 'tuev', doneAt: overdue, mileageAtService: 150000, status: 'done', createdAt: now, updatedAt: now }),
    ])
    return vehicleId as string
  })
}

test.describe('Verkauft oder abgegeben', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('SV-001: verkauftes Fahrzeug fällt aus den Fälligkeiten, Kosten bleiben', async ({ page }) => {
    const vehicleId = await seedVehicleWithCosts(page)
    await page.goto('/dashboard')
    await expect(page.getByRole('region', { name: 'Fällige Arbeiten' })).toContainText('MFK / Prüfung')

    await page.goto(`/vehicles/${vehicleId}`)
    await page.getByRole('button', { name: 'Verkauft' }).click()
    const dialog = page.getByTestId('sell-vehicle-dialog')
    await expect(dialog).toContainText('Fiat Ducato')
    await dialog.locator('#sold-date').fill('2026-09-01')
    await dialog.locator('#sold-mileage').fill('187400')
    await dialog.getByRole('button', { name: 'Als verkauft eintragen' }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.locator('.sold-note')).toContainText('Verkauft am 01.09.2026 bei 187\'400 km')

    // Dashboard: keine Fälligkeit mehr, Kosten weiterhin in der Tabelle
    await page.goto('/dashboard')
    await expect(page.getByRole('region', { name: 'Fällige Arbeiten' })).toHaveCount(0)
    await expect(page.locator('.vehicle-section')).toHaveCount(0)
    await expect(page.getByRole('table', { name: 'Kosten pro Fahrzeug und Jahr' })).toContainText('Fiat Ducato')
    await expect(page.locator('.stats-grid')).toContainText('CHF 640.00')

    // Rechnungen und Wartungen bleiben erhalten
    expect(await countEntities(page, 'invoices')).toBe(1)
    expect(await countEntities(page, 'maintenances')).toBe(1)
  })

  test('SV-002: Fahrzeugliste klappt verkaufte Fahrzeuge zu, Löschdialog bietet den Verkauf an', async ({ page }) => {
    const vehicleId = await seedVehicleWithCosts(page)
    await page.goto('/vehicles')
    await page.locator('.vehicle-card', { hasText: 'Fiat Ducato' }).getByRole('button', { name: 'Löschen' }).click()
    await expect(page.getByText('Fahrzeug löschen?')).toBeVisible()
    await page.getByRole('button', { name: 'Verkauft eintragen' }).click()

    const dialog = page.getByTestId('sell-vehicle-dialog')
    await dialog.locator('#sold-date').fill('2026-09-01')
    await dialog.getByRole('button', { name: 'Als verkauft eintragen' }).click()
    await expect(dialog).not.toBeVisible()

    // Liste zeigt nur noch den zugeklappten Abschnitt
    await expect(page.locator('.vehicle-card')).toHaveCount(0)
    await page.getByRole('button', { name: '1 verkauftes Fahrzeug' }).click()
    const card = page.locator('.vehicle-card', { hasText: 'Fiat Ducato' })
    await expect(card).toContainText('Verkauft am 01.09.2026')

    // Rückgängig: Fahrzeug zählt wieder zur Flotte
    await page.goto(`/vehicles/${vehicleId}`)
    await page.getByRole('button', { name: 'Doch behalten' }).click()
    await expect(page.locator('.sold-note')).toHaveCount(0)
    await page.goto('/vehicles')
    await expect(page.locator('.vehicle-card', { hasText: 'Fiat Ducato' })).toBeVisible()
  })
})
