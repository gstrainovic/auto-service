import type { Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import path from 'node:path'
import { clearInstantDB, expect, mockInvoiceScan, SCAN_INVOICE, test } from './fixtures/test-fixtures'

// Beleg-Scan im Formular «+ Rechnung hinzufügen»: Foto oder PDF wird ausgerichtet, gelesen und füllt die Felder.
// Mistral ist gemockt (mockInvoiceScan), getestet werden Ablauf, Vorbefüllung und Speichern.

async function openInvoiceForm(page: Page): Promise<string> {
  await page.goto('/')
  await page.waitForFunction(() => !!(window as any).__instantdb, { timeout: 30_000 })
  const vehicleId = await page.evaluate(async () => {
    const { db, tx, id: genId } = (window as any).__instantdb
    const v = genId()
    const now = new Date().toISOString()
    await db.transact([tx.vehicles[v].update({ make: 'Porsche', model: 'Cayenne', year: 2008, mileage: 252586, licensePlate: 'SG 218574', createdAt: now, updatedAt: now })])
    return v as string
  })
  await page.goto(`/vehicles/${vehicleId}`)
  await page.getByRole('tab', { name: 'Rechnungen' }).click()
  await page.getByRole('button', { name: /rechnung.*hinzufügen/i }).click()
  return vehicleId
}

const fixture = (name: string) => path.join(import.meta.dirname, 'fixtures', name)

/** Aufrecht heisst: der Rechnungskopf (viel dunkle Schrift) liegt im oberen Drittel der Vorschau, unten ist fast leer */
async function headerOnTop(page: Page): Promise<boolean> {
  return page.locator('[data-pc-name="dialog"] .image-preview img').evaluate((img: HTMLImageElement) => {
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    const ctx = c.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const ink = (y0: number, y1: number) => {
      const d = ctx.getImageData(0, y0, c.width, y1 - y0).data
      let dark = 0
      for (let i = 0; i < d.length; i += 4) {
        if (d[i]! < 128)
          dark++
      }
      return dark
    }
    const h = c.height
    return ink(0, Math.floor(h / 3)) > ink(Math.floor((2 * h) / 3), h)
  })
}

test.describe('Beleg-Scan im Rechnungsformular', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('IS-001: Foto füllt Werkstatt, Datum, Betrag, Währung, Kilometerstand und Positionen; Speichern übernimmt alles', async ({ page }) => {
    await mockInvoiceScan(page)
    const vehicleId = await openInvoiceForm(page)
    const dialog = page.locator('[data-pc-name="dialog"]')

    await dialog.locator('input[type="file"]').setInputFiles(fixture('test-invoice.png'))
    await expect(dialog.getByText('Felder aus der Rechnung ausgefüllt. Bitte prüfen.')).toBeVisible({ timeout: 30_000 })
    await expect(dialog.locator('.image-preview img')).toBeVisible()
    // aufrechtes Hochformat bleibt, wie es ist
    expect(await headerOnTop(page)).toBe(true)

    await expect(dialog.locator('#invoice-workshop')).toHaveValue('Lucky Car Dornbirn')
    await expect(dialog.locator('#invoice-date')).toHaveValue('2025-04-15')
    await expect(dialog.getByRole('button', { name: 'EUR', pressed: true })).toBeVisible()
    const positions = dialog.getByLabel('Erkannte Positionen')
    await expect(positions.locator('.scan-item')).toHaveCount(2)
    // Kategorie per Stichwort korrigiert: Motoröl → Ölwechsel, Auspuff → Auspuff
    await expect(positions).toContainText('Ölwechsel')
    await expect(positions).toContainText('Auspuff')

    await dialog.getByRole('button', { name: 'Speichern' }).click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
    await expect(page.locator('.invoice-item')).toContainText('EUR 1\'403.34')

    const stored = await page.evaluate(async (id) => {
      const { db } = (window as any).__instantdb
      const r = await db.queryOnce({ invoices: {} })
      return (r.data.invoices || []).filter((i: any) => i.vehicleId === id)
    }, vehicleId)
    expect(stored).toHaveLength(1)
    expect(stored[0].mileageAtService).toBe(252586)
    expect(stored[0].items.map((i: any) => i.category)).toEqual(['oelwechsel', 'auspuff'])
    expect(stored[0].imageData?.length).toBeGreaterThan(100)
  })

  test('IS-002: PDF wird gelesen, Felder gefüllt, kein Bild gespeichert', async ({ page }) => {
    await mockInvoiceScan(page)
    await openInvoiceForm(page)
    const dialog = page.locator('[data-pc-name="dialog"]')

    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'rechnung.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF'),
    })
    await expect(dialog.getByText('Felder aus der Rechnung ausgefüllt. Bitte prüfen.')).toBeVisible({ timeout: 30_000 })
    await expect(dialog.locator('.pdf-name')).toContainText('rechnung.pdf')
    await expect(dialog.locator('#invoice-workshop')).toHaveValue('Lucky Car Dornbirn')
  })

  test('IS-003: Scan-Fehler zeigt verständliche Meldung, Formular bleibt von Hand ausfüllbar', async ({ page }) => {
    await mockInvoiceScan(page, { ocrStatus: 402, ocrError: 'Monatslimit erreicht: 5 Scans im Plan Gratis. Upgrade in den Einstellungen.' })
    await openInvoiceForm(page)
    const dialog = page.locator('[data-pc-name="dialog"]')

    await dialog.locator('input[type="file"]').setInputFiles(fixture('test-invoice.png'))
    await expect(dialog.getByText(/Felder bitte selbst ausfüllen/)).toBeVisible({ timeout: 30_000 })
    await expect(dialog.getByText(/Monatslimit erreicht|nicht geklappt/)).toBeVisible()

    await dialog.locator('#invoice-date').fill('2026-02-08')
    await dialog.locator('#invoice-amount input').fill('250')
    await dialog.getByRole('button', { name: 'Speichern' }).click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
    await expect(page.locator('.invoice-item')).toContainText('CHF 250.00')
  })

  test('IS-004: Querformat-Foto wird hochkant ausgerichtet', async ({ page }) => {
    test.setTimeout(90_000)
    await mockInvoiceScan(page)
    await openInvoiceForm(page)
    const dialog = page.locator('[data-pc-name="dialog"]')

    await dialog.locator('input[type="file"]').setInputFiles(fixture('test-invoice-landscape.png'))
    await expect(dialog.getByText('Felder aus der Rechnung ausgefüllt. Bitte prüfen.')).toBeVisible({ timeout: 60_000 })
    const dims = await dialog.locator('.image-preview img').evaluate((img: HTMLImageElement) => ({ w: img.naturalWidth, h: img.naturalHeight }))
    expect(dims.h).toBeGreaterThan(dims.w)
  })

  test('IS-006: auf dem Kopf stehendes Hochformat-Foto wird aufgerichtet', async ({ page }) => {
    test.setTimeout(90_000)
    await mockInvoiceScan(page)
    await openInvoiceForm(page)
    const dialog = page.locator('[data-pc-name="dialog"]')

    // Test-Rechnung im Browser um 180° drehen; Referenz ist das obere Drittel des aufrechten Bildes (Kopf dunkler)
    const png = await fs.readFile(fixture('test-invoice.png'))
    const upsideDown = await page.evaluate(async (b64) => {
      const img = new Image()
      img.src = `data:image/png;base64,${b64}`
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const ctx = c.getContext('2d')!
      ctx.translate(c.width, c.height)
      ctx.rotate(Math.PI)
      ctx.drawImage(img, 0, 0)
      return c.toDataURL('image/png').split(',')[1]
    }, png.toString('base64'))
    await dialog.locator('input[type="file"]').setInputFiles({ name: 'kopfueber.png', mimeType: 'image/png', buffer: Buffer.from(upsideDown!, 'base64') })
    await expect(dialog.getByText('Felder aus der Rechnung ausgefüllt. Bitte prüfen.')).toBeVisible({ timeout: 60_000 })

    expect(await headerOnTop(page)).toBe(true)
  })

  test('IS-009: Beschreibungszeilen mit gemeinsamem Arbeitsbetrag werden eine Position; unstimmige Summe wird gemeldet', async ({ page }) => {
    await mockInvoiceScan(page, {
      photos: [{
        ...SCAN_INVOICE,
        workshopName: 'Seestern - Garage',
        date: '2024-01-05',
        totalAmount: 280.4,
        currency: 'CHF',
        items: [
          { description: 'Auspuff reparieren', category: 'auspuff', amount: 195 },
          { description: 'Auto auf Oelverlust kontrollieren', category: 'sonstiges', amount: 195 },
          { description: 'Motor und Getriebe unten reinigen', category: 'sonstiges', amount: 195 },
          { description: 'Arbeit', category: 'sonstiges', amount: 195 },
          { description: 'Verbinder', category: 'sonstiges', amount: 54.6 },
          { description: 'Klein- & Reinigungs-Material', category: 'sonstiges', amount: 9.8 },
        ],
      }],
    })
    await openInvoiceForm(page)
    const dialog = page.locator('[data-pc-name="dialog"]')
    await dialog.locator('input[type="file"]').setInputFiles(fixture('test-invoice.png'))
    await expect(dialog.getByText('Felder aus der Rechnung ausgefüllt. Bitte prüfen.')).toBeVisible({ timeout: 30_000 })

    const positions = dialog.getByLabel('Erkannte Positionen')
    await expect(positions.locator('.scan-item')).toHaveCount(3)
    await expect(positions.locator('.scan-item').first()).toContainText('Arbeit: Auspuff reparieren, Auto auf Oelverlust kontrollieren, Motor und Getriebe unten reinigen')
    await expect(positions.locator('.scan-item').first()).toContainText('CHF 195.00')
    await expect(dialog.getByRole('alert')).toHaveCount(0)

    // Betrag von Hand zu tief gesetzt: Hinweis erscheint
    await dialog.locator('#invoice-amount input').fill('100')
    await dialog.locator('#invoice-workshop').click()
    await expect(dialog.getByRole('alert')).toContainText('Bitte Positionen prüfen')
  })

  test('IS-005: Eingaben vor dem Scan bleiben erhalten', async ({ page }) => {
    await mockInvoiceScan(page)
    await openInvoiceForm(page)
    const dialog = page.locator('[data-pc-name="dialog"]')

    await dialog.locator('#invoice-date').fill('2026-02-08')
    await dialog.locator('#invoice-workshop').fill('Garage Steinach')
    await dialog.locator('input[type="file"]').setInputFiles(fixture('test-invoice.png'))
    await expect(dialog.getByText('Felder aus der Rechnung ausgefüllt. Bitte prüfen.')).toBeVisible({ timeout: 30_000 })
    await expect(dialog.locator('#invoice-date')).toHaveValue('2026-02-08')
    await expect(dialog.locator('#invoice-workshop')).toHaveValue('Garage Steinach')
  })

  test('IS-007: Sammel-PDF zeigt alle Rechnungen, schon erfasste abgewählt, speichert die gewählten', async ({ page }) => {
    await mockInvoiceScan(page, {
      pdfPages: [
        { ...SCAN_INVOICE, workshopName: 'Seestern - Garage', date: '2022-07-01', totalAmount: 1014.8, currency: 'CHF' },
        { ...SCAN_INVOICE, kind: 'fortsetzung', workshopName: '', date: '', totalAmount: 0, currency: 'CHF' },
        { ...SCAN_INVOICE, workshopName: 'Seestern - Garage', date: '2025-05-15', totalAmount: 278.35, currency: 'CHF' },
        { ...SCAN_INVOICE, kind: 'andere', workshopName: '', date: '', totalAmount: 0, items: [] },
        { ...SCAN_INVOICE, workshopName: 'Seestern - Garage', date: '2024-01-05', totalAmount: 280.4, currency: 'CHF' },
      ],
    })
    const vehicleId = await openInvoiceForm(page)
    // Rechnung vom 01.07.2022 ist schon erfasst (andere Schreibweise der Werkstatt)
    await page.evaluate(async (v) => {
      const { db, tx, id: genId } = (window as any).__instantdb
      const now = new Date().toISOString()
      await db.transact([tx.invoices[genId()].update({ vehicleId: v, workshopName: 'Seestern Garage Ivo Wüst', date: '2022-07-01', totalAmount: 1014.8, currency: 'CHF', items: [], createdAt: now, updatedAt: now })])
    }, vehicleId)
    await expect(page.locator('.invoice-item')).toHaveCount(1)
    const dialog = page.locator('[data-pc-name="dialog"]')

    await dialog.locator('input[type="file"]').setInputFiles({ name: 'stapel.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') })
    await expect(dialog.getByText(/3 Rechnungen erkannt, davon 1 schon erfasst oder doppelt/)).toBeVisible({ timeout: 30_000 })

    const rows = dialog.getByLabel('Erkannte Rechnungen').locator('.batch-row')
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(0)).toContainText('01.07.2022')
    await expect(rows.nth(0)).toContainText('Seite 1–2')
    await expect(rows.nth(0)).toContainText('bereits erfasst')
    await expect(rows.nth(0).getByRole('checkbox')).not.toBeChecked()
    await expect(rows.nth(1).getByRole('checkbox')).toBeChecked()
    await expect(dialog.locator('#invoice-date')).toHaveCount(0)

    await dialog.getByRole('button', { name: '2 Rechnungen speichern' }).click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
    await expect(page.locator('.invoice-item')).toHaveCount(3)
    await expect(page.locator('.invoice-item', { hasText: '15.05.2025' })).toContainText('CHF 278.35')
  })

  test('IS-008: mehrere Fotos auf einmal werden je eine Rechnung mit Foto', async ({ page }) => {
    await mockInvoiceScan(page, {
      photos: [
        { ...SCAN_INVOICE, date: '2025-04-15', totalAmount: 1403.34 },
        { ...SCAN_INVOICE, workshopName: 'Pneu Egger', date: '2025-10-02', totalAmount: 890.5, currency: 'CHF' },
      ],
    })
    const vehicleId = await openInvoiceForm(page)
    const dialog = page.locator('[data-pc-name="dialog"]')

    await dialog.locator('input[type="file"]').setInputFiles([fixture('test-invoice.png'), fixture('test-kaufvertrag.png')])
    await expect(dialog.getByText('2 Rechnungen erkannt. Bitte prüfen.')).toBeVisible({ timeout: 60_000 })
    const rows = dialog.getByLabel('Erkannte Rechnungen').locator('.batch-row')
    await expect(rows.nth(1)).toContainText('Pneu Egger')
    await expect(rows.nth(1)).toContainText('test-kaufvertrag.png')

    // eine Rechnung abwählen
    await rows.nth(0).getByRole('checkbox').click()
    await dialog.getByRole('button', { name: '1 Rechnung speichern' }).click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    const stored = await page.evaluate(async (id) => {
      const { db } = (window as any).__instantdb
      const r = await db.queryOnce({ invoices: {} })
      return (r.data.invoices || []).filter((i: any) => i.vehicleId === id)
    }, vehicleId)
    expect(stored.map((i: any) => i.workshopName)).toEqual(['Pneu Egger'])
    expect(stored[0].imageData?.length).toBeGreaterThan(100)
  })

  test('IS-010: Rechnung übers Formular legt Wartungen je Kategorie an und hebt den Kilometerstand', async ({ page }) => {
    await mockInvoiceScan(page, {
      photos: [{
        ...SCAN_INVOICE,
        date: '2026-06-01',
        mileageAtService: 260000,
        currency: 'CHF',
        totalAmount: 520,
        items: [
          { description: 'Ölwechsel', category: 'oelwechsel', amount: 180 },
          { description: 'Ölfilter', category: 'oelwechsel', amount: 40 },
          { description: 'Bremsbeläge vorne', category: 'bremsen', amount: 300 },
        ],
      }],
    })
    const vehicleId = await openInvoiceForm(page)
    const dialog = page.locator('[data-pc-name="dialog"]')
    await dialog.locator('input[type="file"]').setInputFiles(fixture('test-invoice.png'))
    await expect(dialog.getByText('Felder aus der Rechnung ausgefüllt. Bitte prüfen.')).toBeVisible({ timeout: 30_000 })
    await dialog.getByRole('button', { name: 'Speichern' }).click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    const state = await page.evaluate(async (id) => {
      const { db } = (window as any).__instantdb
      const r = await db.queryOnce({ invoices: {}, maintenances: {}, vehicles: {} })
      const invoice = (r.data.invoices || []).find((i: any) => i.vehicleId === id)
      return {
        maintenances: (r.data.maintenances || []).filter((m: any) => m.vehicleId === id).map((m: any) => [m.type, m.doneAt, m.invoiceId === invoice?.id]).sort(),
        mileage: (r.data.vehicles || []).find((v: any) => v.id === id)?.mileage,
      }
    }, vehicleId)
    expect(state.maintenances).toEqual([['bremsen', '2026-06-01', true], ['oelwechsel', '2026-06-01', true]])
    expect(state.mileage).toBe(260000)

    // Dashboard: Ölwechsel ist nicht mehr «Kein Eintrag»
    await page.goto('/dashboard')
    const oil = page.locator('.maintenance-item', { hasText: 'Ölwechsel' }).first()
    await expect(oil).toContainText('01.06.2026')
  })

  test('IS-011: Sammel-PDF ordnet Rechnungen per Kontrollschild dem richtigen Fahrzeug zu', async ({ page }) => {
    await mockInvoiceScan(page, {
      pdfPages: [
        { ...SCAN_INVOICE, workshopName: 'Garage A', date: '2025-02-01', totalAmount: 200, currency: 'CHF', licensePlate: 'SG 218574' },
        { ...SCAN_INVOICE, workshopName: 'Garage B', date: '2025-03-01', totalAmount: 300, currency: 'CHF', licensePlate: 'SG5' },
        { ...SCAN_INVOICE, workshopName: 'Garage C', date: '2025-04-01', totalAmount: 400, currency: 'CHF', licensePlate: 'ZH 99' },
      ],
    })
    const porsche = await openInvoiceForm(page)
    const caddy = await page.evaluate(async () => {
      const { db, tx, id: genId } = (window as any).__instantdb
      const v = genId()
      const now = new Date().toISOString()
      await db.transact([tx.vehicles[v].update({ make: 'VW', model: 'Caddy', year: 2019, mileage: 68500, licensePlate: 'SG 5', createdAt: now, updatedAt: now })])
      return v as string
    })
    const dialog = page.locator('[data-pc-name="dialog"]')
    await dialog.locator('input[type="file"]').setInputFiles({ name: 'stapel.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') })
    await expect(dialog.getByText(/3 Rechnungen erkannt, 2 mit anderem Kontrollschild/)).toBeVisible({ timeout: 30_000 })

    const rows = dialog.getByLabel('Erkannte Rechnungen').locator('.batch-row')
    await expect(rows.nth(1)).toContainText('Kontrollschild SG 5: VW Caddy')
    await expect(rows.nth(2)).toContainText('Kontrollschild ZH 99 gehört zu keinem Fahrzeug')
    await expect(rows.nth(2).getByRole('checkbox')).not.toBeChecked()

    await dialog.getByRole('button', { name: '2 Rechnungen speichern' }).click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
    const byVehicle = await page.evaluate(async () => {
      const { db } = (window as any).__instantdb
      const r = await db.queryOnce({ invoices: {} })
      return (r.data.invoices || []).map((i: any) => [i.workshopName, i.vehicleId]).sort()
    })
    expect(byVehicle).toEqual([['Garage A', porsche], ['Garage B', caddy]])
  })
})
