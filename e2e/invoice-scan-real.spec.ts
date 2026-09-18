import type { Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { clearInstantDB, expect, test, waitForInstantDB } from './fixtures/test-fixtures'

// Beleg-Scan im Formular mit ECHTEM Mistral über den lokalen AI-Proxy und echten Fotos aus tmp/ (gitignored).
// Kostet OCR-Seiten, darum nur im Projekt ai-soft: npx playwright test e2e/invoice-scan-real.spec.ts --project=ai-soft
// Geprüft wird der Endzustand der Felder, nicht der genaue Wortlaut der KI.

const TMP = path.join(import.meta.dirname, '..', 'tmp')
const photos = fs.existsSync(path.join(TMP, 'test-images'))
  ? fs.readdirSync(path.join(TMP, 'test-images')).filter(f => f.endsWith('.jpg')).sort().slice(0, 3)
  : []
const pdf = path.join(TMP, 'test-images-9pages.pdf')

async function openInvoiceForm(page: Page): Promise<void> {
  await page.goto('/')
  await waitForInstantDB(page)
  const vehicleId = await page.evaluate(async () => {
    const { db, tx, id: genId } = (window as any).__instantdb
    const v = genId()
    const now = new Date().toISOString()
    await db.transact([tx.vehicles[v].update({ make: 'Porsche', model: 'Cayenne', year: 2008, mileage: 231457, licensePlate: 'SG 218574', createdAt: now, updatedAt: now })])
    return v as string
  })
  await page.goto(`/vehicles/${vehicleId}`)
  await page.getByRole('tab', { name: 'Rechnungen' }).click()
  await page.getByRole('button', { name: /rechnung.*hinzufügen/i }).click()
}

async function readForm(page: Page) {
  const dialog = page.locator('[data-pc-name="dialog"]')
  return {
    message: (await dialog.locator('.scan-message').textContent())?.trim(),
    workshop: await dialog.locator('#invoice-workshop').inputValue(),
    date: await dialog.locator('#invoice-date').inputValue(),
    amount: await dialog.locator('#invoice-amount input').inputValue(),
    currency: (await dialog.getByRole('button', { pressed: true }).first().textContent())?.trim(),
    mileage: await dialog.locator('#invoice-mileage input').inputValue(),
    items: await dialog.locator('.scan-item').allTextContents(),
    preview: await dialog.locator('.image-preview img').evaluate((img: HTMLImageElement) => `${img.naturalWidth}x${img.naturalHeight}`).catch(() => '-'),
  }
}

test.describe('Beleg-Scan mit echtem Mistral @soft', () => {
  test.setTimeout(180_000)

  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  for (const photo of photos) {
    test(`Foto ${photo} füllt Datum, Betrag und Positionen @soft`, async ({ page }) => {
      await openInvoiceForm(page)
      const dialog = page.locator('[data-pc-name="dialog"]')
      await dialog.locator('input[type="file"]').setInputFiles(path.join(TMP, 'test-images', photo))
      await expect(dialog.locator('.scan-message')).toBeVisible({ timeout: 150_000 })
      const form = await readForm(page)
      // eslint-disable-next-line no-console
      console.log(`[real-scan] ${photo}`, JSON.stringify(form))
      // Kilometerstand im Schweizer Format, falls erkannt
      if (form.mileage)
        expect(form.mileage).toMatch(/^\d{1,3}(’\d{3})* km$/)
      expect(form.message).toContain('Felder aus der Rechnung ausgefüllt')
      expect(form.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(form.amount).not.toBe('')
      expect(form.items.length).toBeGreaterThan(0)
      // Positionen dürfen zusammen nicht mehr als die Rechnung ergeben (Hinweis im Formular)
      await expect(dialog.getByRole('alert')).toHaveCount(0)
      if (photo === 'IMG_20260131_234544306.jpg') {
        // Seestern 8243: eine Arbeitsposition CHF 195.00 für drei Beschreibungszeilen, nicht vier
        expect(form.items.filter(i => i.includes('195.00'))).toHaveLength(1)
      }
      const [w, h] = form.preview.split('x').map(Number)
      expect(h).toBeGreaterThan(w!)
    })
  }

  test('Fahrzeugausweis (Wikimedia, gemeinfrei) füllt das Fahrzeugformular @soft', async ({ page }) => {
    await page.goto('/vehicles?action=add')
    const dialog = page.locator('[data-pc-name="dialog"]')
    await dialog.locator('input[type="file"]').setInputFiles(path.join(import.meta.dirname, 'fixtures', 'fahrzeugausweis-schweiz.jpg'))
    await expect(dialog.getByText(/Felder aus dem Dokument ausgefüllt|Felder bitte selbst ausfüllen|keine Fahrzeugdaten/)).toBeVisible({ timeout: 150_000 })
    const values = {
      make: await dialog.getByLabel('Marke').inputValue(),
      model: await dialog.getByLabel('Modell').inputValue(),
      year: await dialog.getByLabel('Baujahr').inputValue(),
      mileage: await dialog.getByLabel('Kilometerstand').inputValue(),
      plate: await dialog.getByLabel('Kontrollschild').inputValue(),
      vin: await dialog.locator('#vin').inputValue(),
    }
    // eslint-disable-next-line no-console
    console.log('[real-scan] fahrzeugausweis', JSON.stringify(values))
    expect(values.make).toMatch(/saurer/i)
    expect(values.model).toMatch(/3\s*DUX/i)
    expect(values.year).toBe('1964')
    expect(values.mileage).toBe('405’260 km')
    expect(values.plate).toMatch(/^BS/)
    expect(values.vin.replace(/\s/g, '')).toBe('2100728')
  })

  test('Porsche-Serviceheft: Wartungsplan und Stempelseite ergeben Intervalle und Einträge @soft', async ({ page }) => {
    const dir = path.join(TMP, 'wartungen')
    test.skip(!fs.existsSync(dir), 'tmp/wartungen fehlt')
    // Seite 10/11 (Regelwartung, kleine Wartung alle 30'000 km oder 2 Jahre) und der Wartungsnachweis mit sechs Stempeln
    const pages = ['IMG_20260201_112605535.jpg', 'IMG_20260201_112613253.jpg', 'IMG_20260201_112713720.jpg'].map(f => path.join(dir, f))
    await page.goto('/')
    await waitForInstantDB(page)
    const vehicleId = await page.evaluate(async () => {
      const { db, tx, id: genId } = (window as any).__instantdb
      const v = genId()
      const now = new Date().toISOString()
      await db.transact([tx.vehicles[v].update({ make: 'Porsche', model: 'Cayenne', year: 2008, mileage: 231457, licensePlate: 'SG 218574', createdAt: now, updatedAt: now })])
      return v as string
    })
    await page.goto(`/vehicles/${vehicleId}`)
    await page.locator('.plan-source').getByRole('button', { name: 'Serviceheft fotografieren' }).click()
    const dialog = page.getByTestId('service-book-dialog')
    await dialog.locator('input[type="file"]').setInputFiles(pages)
    await expect(dialog.getByRole('status')).toContainText('Bitte prüfen', { timeout: 170_000 })
    const status = await dialog.getByRole('status').textContent()
    const entries = await dialog.locator('.book-entry').allTextContents()
    const intervals = await dialog.locator('.interval-row[data-type]').evaluateAll(rows => rows.map(r => `${r.getAttribute('data-type')}:${(r.querySelectorAll('input')[1] as HTMLInputElement).value}/${(r.querySelectorAll('input')[2] as HTMLInputElement).value}`))
    // eslint-disable-next-line no-console
    console.log('[real-scan] serviceheft', JSON.stringify({ status, entries, intervals }, null, 1))
    expect(status).not.toContain('keine Hersteller-Intervalle')
    // Stempelseite: mehrere Einträge mit Datum und Kilometerstand
    expect(entries.length).toBeGreaterThanOrEqual(4)
    expect(entries.filter(e => /\d{2}\.\d{2}\.20\d{2}/.test(e) && /\d{2}'\d{3} km/.test(e)).length).toBeGreaterThanOrEqual(4)
    // keine Zeile aus der Checkliste der kleinen Wartung
    expect(entries.every(e => e.length < 150)).toBe(true)
    expect(entries.some(e => /Sichtprüfung/.test(e))).toBe(false)
    // Service alle 30'000 km, nicht dasselbe Intervall über die halbe Liste
    expect(intervals).toContain('inspektion:30’000 km/24 Mt.')
    expect(intervals.filter(i => i.includes('30’000 km')).length).toBeLessThanOrEqual(4)
  })

  test('Sammel-PDF wird in einzelne Rechnungen aufgeteilt @soft', async ({ page }) => {
    test.skip(!fs.existsSync(pdf), 'tmp/test-images-9pages.pdf fehlt')
    // 22 MB, 9 Seiten: OCR und Auswertung dauern rund drei Minuten
    test.setTimeout(420_000)
    await openInvoiceForm(page)
    const dialog = page.locator('[data-pc-name="dialog"]')
    await dialog.locator('input[type="file"]').setInputFiles(pdf)
    await expect(dialog.locator('.scan-message')).toBeVisible({ timeout: 400_000 })
    const message = (await dialog.locator('.scan-message').textContent())?.trim()
    const rows = await dialog.locator('.batch-row').allTextContents()
    // eslint-disable-next-line no-console
    console.log('[real-scan] pdf', message, JSON.stringify(rows, null, 1))
    expect(message).toMatch(/\d+ Rechnungen erkannt/)
    expect(rows.length).toBeGreaterThan(1)
  })
})
