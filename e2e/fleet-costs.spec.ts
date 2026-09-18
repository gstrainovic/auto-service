import type { Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { clearInstantDB, expect, test, waitForInstantDB } from './fixtures/test-fixtures'

// Fuhrpark-Übersicht auf dem Dashboard (Kosten pro Fahrzeug und Jahr in der Heimwährung) und
// Umrechnung fremder Währungen zum EZB-Kurs am Rechnungsdatum (Frankfurter-API, hier gemockt)

async function seedFleet(page: Page): Promise<{ v1: string, v2: string }> {
  await page.goto('/')
  await waitForInstantDB(page)
  return page.evaluate(async () => {
    const { db, tx, id: genId } = (window as any).__instantdb
    const v1 = genId()
    const v2 = genId()
    const now = new Date().toISOString()
    await db.transact([
      tx.vehicles[v1].update({ make: 'Fiat', model: 'Ducato', year: 2021, mileage: 40000, licensePlate: 'SG 1', createdAt: now, updatedAt: now }),
      tx.vehicles[v2].update({ make: 'VW', model: 'Caddy', year: 2019, mileage: 68500, licensePlate: 'SG 2', createdAt: now, updatedAt: now }),
      tx.invoices[genId()].update({ vehicleId: v1, workshopName: 'Garage Muster', date: '2026-03-10', totalAmount: 400, currency: 'CHF', items: [{ description: 'Service', category: 'inspektion', amount: 400 }], createdAt: now, updatedAt: now }),
      tx.invoices[genId()].update({ vehicleId: v1, workshopName: 'Werkstatt Lindau', date: '2026-05-20', totalAmount: 100, currency: 'EUR', items: [{ description: 'Reifen', category: 'reifen', amount: 100 }], createdAt: now, updatedAt: now }),
      tx.invoices[genId()].update({ vehicleId: v2, workshopName: 'Pneu Egger', date: '2025-11-02', totalAmount: 250, currency: 'CHF', items: [{ description: 'Winterreifen', category: 'reifen', amount: 250 }], createdAt: now, updatedAt: now }),
    ])
    return { v1, v2 }
  })
}

test.describe('Fuhrpark-Kosten und Währungsumrechnung', () => {
  test.beforeEach(async ({ page }) => {
    // Frankfurter-API mocken: 1 EUR = 0.95 CHF, unabhängig vom Datum. Vor clearInstantDB, weil das
    // Dashboard beim Aufräumen noch alte Rechnungen sieht und sonst den echten Kurs in den Cache legt.
    await page.route('**/api.frankfurter.dev/**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ amount: 1, base: 'EUR', date: '2026-05-20', rates: { CHF: 0.95 } }),
    }))
    await clearInstantDB(page)
  })

  test('FC-001: Dashboard zeigt Kosten pro Fahrzeug und Jahr in CHF, EUR umgerechnet', async ({ page }) => {
    await seedFleet(page)
    await page.goto('/dashboard')
    const table = page.getByRole('table', { name: 'Kosten pro Fahrzeug und Jahr' })
    await expect(table).toBeVisible()
    // Fiat 2026: 400 CHF + 100 EUR × 0.95 = 495.00
    await expect(table.getByRole('row').filter({ hasText: 'Fiat Ducato' }).filter({ hasText: '2026' })).toContainText('CHF 495.00')
    await expect(table.getByRole('row').filter({ hasText: 'VW Caddy' }).filter({ hasText: '2025' })).toContainText('CHF 250.00')
    await expect(page.getByText(/1 Rechnung in EUR zum EZB-Kurs am Rechnungsdatum umgerechnet/)).toBeVisible()
    // Kachel «Gesamtkosten» rechnet ebenfalls um: 400 + 95 + 250 = 745.00, keine getrennte EUR-Summe mehr
    const stats = page.locator('.stats-grid')
    await expect(stats).toContainText('CHF 745.00')
    await expect(stats).not.toContainText('EUR')
    // Fahrzeugkarte rechnet gleich: Fiat 400 + 95 = 495.00, nicht 500 durch 1:1-Addition
    await expect(page.locator('.vehicle-section', { hasText: 'Fiat Ducato' }).locator('.vehicle-cost')).toHaveText(/CHF 495\.00 · 2 Rechnungen/)
  })

  test('FC-002: Fahrzeugseite rechnet EUR in die Heimwährung um', async ({ page }) => {
    const { v1 } = await seedFleet(page)
    await page.goto(`/vehicles/${v1}`)
    await page.getByRole('tab', { name: 'Kosten' }).click()
    const table = page.getByRole('table', { name: 'Kosten pro Jahr' })
    await expect(table.getByRole('columnheader', { name: /2026/ })).toBeVisible()
    await expect(table.getByRole('row').filter({ hasText: 'Reifen' })).toContainText('95.00')
    await expect(table.locator('tr.costs-total-row')).toContainText('CHF 495.00')
  })

  test('FC-003: CSV über alle Fahrzeuge enthält beide Fahrzeuge und den Kurs', async ({ page }) => {
    await seedFleet(page)
    await page.goto('/dashboard')
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export' }).click()
    await page.getByRole('menuitem', { name: 'CSV für Excel, alle Fahrzeuge' }).click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/^wartungsheft-alle-fahrzeuge-\d{4}-\d{2}-\d{2}\.csv$/)
    const text = await (await file.createReadStream()).toArray().then(chunks => Buffer.concat(chunks as Buffer[]).toString('utf8'))
    expect(text).toContain('Betrag CHF;Kurs')
    expect(text).toContain('Fiat Ducato;SG 1;2026-05-20;Werkstatt Lindau;;Reifen;Reifen;100.00;EUR;95.00;0.95')
    expect(text).toContain('VW Caddy;SG 2;2025-11-02;Pneu Egger;;Reifen;Winterreifen;250.00;CHF;250.00;1')
  })

  test('FC-006: PDF-Übersicht über alle Fahrzeuge wird als Datei geladen', async ({ page }) => {
    await seedFleet(page)
    await page.goto('/dashboard')
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export' }).click()
    await page.getByRole('menuitem', { name: 'PDF-Übersicht, alle Fahrzeuge' }).click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/^wartungsheft-alle-fahrzeuge-\d{4}-\d{2}-\d{2}\.pdf$/)
    const bytes = await (await file.createReadStream()).toArray().then(chunks => Buffer.concat(chunks as Buffer[]))
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
    expect(bytes.length).toBeGreaterThan(3000)
  })

  test('FC-005: Fahrzeugseite zeigt nur die eigenen Rechnungen und Kosten', async ({ page }) => {
    const { v2 } = await seedFleet(page)
    await page.goto(`/vehicles/${v2}`)
    await page.getByRole('tab', { name: 'Rechnungen' }).click()
    await expect(page.locator('.invoice-item')).toHaveCount(1)
    await expect(page.locator('.invoice-item')).toContainText('Pneu Egger')
    await page.getByRole('tab', { name: 'Kosten' }).click()
    const table = page.getByRole('table', { name: 'Kosten pro Jahr' })
    await expect(table.getByRole('columnheader', { name: /2025/ })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: /2026/ })).toHaveCount(0)
    await expect(table.locator('tr.costs-total-row')).toContainText('CHF 250.00')
  })

  test('FC-004: Heimwährung ist in den Einstellungen wählbar', async ({ page }) => {
    await page.goto('/settings')
    const select = page.locator('.form-field', { hasText: 'Heimwährung' }).locator('[role="combobox"]')
    await expect(select).toBeVisible()
    await select.click()
    await page.getByRole('option', { name: 'EUR' }).click()
    expect(await page.evaluate(() => localStorage.getItem('homeCurrency'))).toBe('EUR')
    await select.click()
    await page.getByRole('option', { name: 'CHF' }).click()
    expect(await page.evaluate(() => localStorage.getItem('homeCurrency'))).toBe('CHF')
  })
})
