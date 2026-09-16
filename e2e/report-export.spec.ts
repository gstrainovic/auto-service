import type { Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

// Kostenübersicht pro Jahr und Kategorie, CSV für Excel/Treuhänder, PDF-Dossier für Verkauf und Übergabe

async function seedVehicleWithInvoices(page: Page): Promise<string> {
  await page.goto('/')
  await page.waitForFunction(() => !!(window as any).__instantdb, { timeout: 30_000 })
  return page.evaluate(async () => {
    const { db, tx, id: genId } = (window as any).__instantdb
    const vehicleId = genId()
    const now = new Date().toISOString()
    await db.transact([
      tx.vehicles[vehicleId].update({ make: 'VW', model: 'Caddy', year: 2019, mileage: 68500, licensePlate: 'SG 12345', createdAt: now, updatedAt: now }),
      tx.invoices[genId()].update({ vehicleId, workshopName: 'Garage Muster', date: '2025-11-02', totalAmount: 480, currency: 'CHF', mileageAtService: 61000, items: [
        { description: 'Ölwechsel', category: 'oelwechsel', amount: 180 },
        { description: 'Bremsbeläge vorne', category: 'bremsen', amount: 300 },
      ], createdAt: now, updatedAt: now }),
      tx.invoices[genId()].update({ vehicleId, workshopName: 'Pneu Egger', date: '2026-03-10', totalAmount: 890.5, currency: 'CHF', mileageAtService: 68500, items: [
        { description: 'Sommerreifen', category: 'reifen', amount: 890.5 },
      ], createdAt: now, updatedAt: now }),
      tx.maintenances[genId()].update({ vehicleId, type: 'oelwechsel', doneAt: '2025-11-02', mileageAtService: 61000, status: 'done', createdAt: now, updatedAt: now }),
    ])
    return vehicleId as string
  })
}

test.describe('Kosten und Export', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('RE-001: Kosten-Tab zeigt Summen pro Jahr und Kategorie', async ({ page }) => {
    const vehicleId = await seedVehicleWithInvoices(page)
    await page.goto(`/vehicles/${vehicleId}`)
    await page.getByRole('tab', { name: 'Kosten' }).click()

    // Jahre als Spalten (neuestes zuerst), Kategorien als Zeilen, Total-Zeile und Total-Spalte
    const table = page.getByRole('table', { name: 'Kosten pro Jahr' })
    await expect(table).toBeVisible()
    const headers = table.getByRole('columnheader')
    await expect(headers.nth(1)).toHaveText(/2026/)
    await expect(headers.nth(2)).toHaveText(/2025/)
    await expect(table.getByRole('row').filter({ hasText: 'Ölwechsel' })).toContainText('180.00')
    await expect(table.getByRole('row').filter({ hasText: 'Bremsen' })).toContainText('300.00')
    await expect(table.getByRole('row').filter({ hasText: 'Reifen' })).toContainText('890.50')
    const total = table.locator('tr.costs-total-row')
    await expect(total).toContainText('CHF 890.50')
    await expect(total).toContainText('CHF 480.00')
  })

  test('RE-002: CSV-Export liefert eine Excel-taugliche Datei', async ({ page }) => {
    const vehicleId = await seedVehicleWithInvoices(page)
    await page.goto(`/vehicles/${vehicleId}`)
    await page.getByRole('tab', { name: 'Kosten' }).click()

    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'CSV für Excel' }).click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/^wartungsheft-vw-caddy-sg-12345-\d{4}-\d{2}-\d{2}\.csv$/)
    const text = await (await file.createReadStream()).toArray().then(chunks => Buffer.concat(chunks as Buffer[]).toString('utf8'))
    expect(text.startsWith('﻿Fahrzeug;Kennzeichen;Datum;Werkstatt')).toBe(true)
    expect(text).toContain('VW Caddy;SG 12345;2025-11-02;Garage Muster;61000;Ölwechsel;Ölwechsel;180.00;CHF')
    expect(text).toContain('2026-03-10;Pneu Egger;68500;Reifen;Sommerreifen;890.50;CHF')
  })

  test('RE-004: CSV weist die Differenz zwischen Positionen und Rechnungstotal als eigene Zeile aus', async ({ page }) => {
    const vehicleId = await seedVehicleWithInvoices(page)
    // Rechnung mit MwSt. und Kleinmaterial ohne eigene Position: Positionen 120.00, Total 150.00
    await page.evaluate(async (vId: string) => {
      const { db, tx, id: genId } = (window as any).__instantdb
      const now = new Date().toISOString()
      await db.transact([tx.invoices[genId()].update({ vehicleId: vId, workshopName: 'Garage Kunz', date: '2026-04-01', totalAmount: 150, currency: 'CHF', items: [
        { description: 'Scheibenwischer', category: 'sonstiges', amount: 120 },
      ], createdAt: now, updatedAt: now })])
    }, vehicleId)
    await page.goto(`/vehicles/${vehicleId}`)
    await page.getByRole('tab', { name: 'Kosten' }).click()

    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'CSV für Excel' }).click()
    const text = await (await (await download).createReadStream()).toArray().then(chunks => Buffer.concat(chunks as Buffer[]).toString('utf8'))
    expect(text).toContain('2026-04-01;Garage Kunz;;Sonstiges;Scheibenwischer;120.00;CHF')
    expect(text).toContain('2026-04-01;Garage Kunz;;Nicht zugeordnet / MwSt.;Differenz zum Rechnungstotal;30.00;CHF')
    // Rechnungen ohne Differenz bekommen keine Zusatzzeile
    expect(text.match(/Differenz zum Rechnungstotal/g)).toHaveLength(1)
  })

  test('RE-005: Jahresabschluss lädt ein ZIP mit CSV und Belegbildern', async ({ page }) => {
    await seedVehicleWithInvoices(page)
    // ein Beleg mit Bild, damit das Archiv auch Belege enthält
    await page.evaluate(async () => {
      const { db, tx } = (window as any).__instantdb
      const result = await db.queryOnce({ invoices: {} })
      const inv = (result.data.invoices || []).find((i: any) => i.date === '2026-03-10')
      await db.transact([tx.invoices[inv.id].update({ imageData: '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAg=' })])
    })
    await page.goto('/dashboard')
    await expect(page.getByLabel('Jahr für den Jahresabschluss')).toBeVisible()

    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: /ZIP mit CSV und Belegen 2026/ }).click()
    const file = await download
    expect(file.suggestedFilename()).toBe('wartungsheft-jahresabschluss-2026.zip')
    const bytes = await (await file.createReadStream()).toArray().then(chunks => Buffer.concat(chunks as Buffer[]))
    // gültiges ZIP mit CSV und einem Beleg
    expect(bytes.subarray(0, 4).toString('hex')).toBe('504b0304')
    const dump = bytes.toString('latin1')
    expect(dump).toContain('kosten-2026.csv')
    expect(dump).toContain('belege/2026-03-10-vw-caddy-pneu-egger.jpg')
    expect(dump).not.toContain('2025-11-02')
    await expect(page.getByText('CSV und 1 Beleg geladen.')).toBeVisible()
  })

  test('RE-006: Serviceheft für den Verkauf lädt als PDF, Preise nur auf Wunsch', async ({ page }) => {
    const vehicleId = await seedVehicleWithInvoices(page)
    await page.goto(`/vehicles/${vehicleId}`)
    await page.getByRole('tab', { name: 'Kosten' }).click()

    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Serviceheft für den Verkauf' }).click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/^serviceheft-vw-caddy-sg-12345-\d{4}-\d{2}-\d{2}\.pdf$/)
    const bytes = await (await file.createReadStream()).toArray().then(chunks => Buffer.concat(chunks as Buffer[]))
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
    expect(bytes.length).toBeGreaterThan(2000)

    // mit Preisen wird das PDF grösser, weil die Kostenseite dazukommt
    await page.locator('#service-record-prices').click()
    const withPrices = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Serviceheft für den Verkauf' }).click()
    const priced = await (await (await withPrices).createReadStream()).toArray().then(chunks => Buffer.concat(chunks as Buffer[]))
    expect(priced.length).toBeGreaterThan(bytes.length)
  })

  test('RE-003: PDF-Dossier wird als Datei geladen', async ({ page }) => {
    const vehicleId = await seedVehicleWithInvoices(page)
    await page.goto(`/vehicles/${vehicleId}`)
    await page.getByRole('tab', { name: 'Kosten' }).click()

    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'PDF-Dossier' }).click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/^wartungsheft-vw-caddy-sg-12345-\d{4}-\d{2}-\d{2}\.pdf$/)
    const bytes = await (await file.createReadStream()).toArray().then(chunks => Buffer.concat(chunks as Buffer[]))
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
    expect(bytes.length).toBeGreaterThan(2000)
  })
})
