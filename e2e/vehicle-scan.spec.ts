import path from 'node:path'
import { clearInstantDB, expect, mockInvoiceScan, test, waitForInstantDB } from './fixtures/test-fixtures'

// «Neues Fahrzeug» per Fahrzeugausweis: Foto lesen, leere Felder füllen, speichern.
// Bild: gemeinfreier Beispiel-Fahrzeugausweis von Wikimedia Commons (e2e/fixtures/LIZENZEN.md). Mistral gemockt.

const ausweis = path.join(import.meta.dirname, 'fixtures', 'fahrzeugausweis-schweiz.jpg')

test.describe('Fahrzeug per Fahrzeugausweis', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('VS-001: Ausweis-Foto füllt das Formular, Speichern legt das Fahrzeug an', async ({ page }) => {
    await mockInvoiceScan(page)
    await page.goto('/vehicles?action=add')
    const dialog = page.locator('[data-pc-name="dialog"]')
    await expect(dialog.getByText('Fahrzeugausweis fotografieren')).toBeVisible()

    await dialog.locator('input[type="file"]').setInputFiles(ausweis)
    await expect(dialog.getByText('Felder aus dem Dokument ausgefüllt. Bitte prüfen.')).toBeVisible({ timeout: 60_000 })
    await expect(dialog.getByLabel('Marke')).toHaveValue('Saurer')
    await expect(dialog.getByLabel('Modell')).toHaveValue('3 DUX')
    await expect(dialog.getByLabel('Baujahr')).toHaveValue('1964')
    await expect(dialog.getByLabel('Kilometerstand')).toHaveValue('405’260 km')
    await expect(dialog.getByLabel('Kontrollschild')).toHaveValue('BS')
    await expect(dialog.locator('#vin')).toHaveValue('2 100 728')
    // Ausweis ist quer und bleibt quer
    const dims = await dialog.locator('.doc-preview').evaluate((img: HTMLImageElement) => ({ w: img.naturalWidth, h: img.naturalHeight }))
    expect(dims.w).toBeGreaterThan(dims.h)

    await dialog.getByRole('button', { name: 'Speichern' }).click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('heading', { name: 'Saurer 3 DUX' })).toBeVisible()
  })

  test('VS-002: Eingaben vor dem Scan bleiben, Scan-Fehler lässt das Formular bedienbar', async ({ page }) => {
    // 402 wie beim Monatslimit: erwarteter Fehler ohne Konsolenfehler der App
    await mockInvoiceScan(page, { ocrStatus: 402, ocrError: 'Monatslimit erreicht: 5 Scans im Plan Gratis. Upgrade in den Einstellungen.' })
    await page.goto('/vehicles?action=add')
    const dialog = page.locator('[data-pc-name="dialog"]')
    await dialog.getByLabel('Marke').fill('Porsche')
    await dialog.locator('input[type="file"]').setInputFiles(ausweis)
    await expect(dialog.getByText(/Felder bitte selbst ausfüllen/)).toBeVisible({ timeout: 60_000 })
    await expect(dialog.getByLabel('Marke')).toHaveValue('Porsche')
  })

  test('VS-003: beim Bearbeiten ergänzt der Ausweis nur leere Felder (z. B. nach einem Kaufvertrag)', async ({ page }) => {
    await mockInvoiceScan(page)
    await page.goto('/')
    await waitForInstantDB(page)
    const id = await page.evaluate(async () => {
      const { db, tx, id: genId } = (window as any).__instantdb
      const v = genId()
      const now = new Date().toISOString()
      await db.transact([tx.vehicles[v].update({ make: 'VW', model: 'Caddy', year: 2019, mileage: 68500, licensePlate: 'SG 1', createdAt: now, updatedAt: now })])
      return v as string
    })
    await page.goto(`/vehicles/${id}`)
    // Checkliste: ohne Fahrgestellnummer ist der Ausweis offen, ihr Knopf öffnet das Formular mit Scan
    const setup = page.getByTestId('setup-checklist')
    await expect(setup.locator('[data-step="ausweis"]')).toContainText('Fehlt noch: Fahrgestellnummer')
    await setup.getByRole('button', { name: 'Fahrzeugausweis fotografieren' }).click()
    const dialog = page.getByRole('dialog', { name: 'Fahrzeug bearbeiten' })
    await expect(dialog.getByLabel('Marke')).toHaveValue('VW')

    await dialog.locator('input[type="file"]').setInputFiles(ausweis)
    await expect(dialog.getByText('Felder aus dem Dokument ausgefüllt. Bitte prüfen.')).toBeVisible({ timeout: 60_000 })
    // Vorhandenes bleibt, nur die leere Fahrgestellnummer kommt aus dem Ausweis
    await expect(dialog.getByLabel('Marke')).toHaveValue('VW')
    await expect(dialog.getByLabel('Kontrollschild')).toHaveValue('SG 1')
    await expect(dialog.locator('#vin')).toHaveValue('2 100 728')
    await dialog.getByRole('button', { name: 'Speichern' }).click()
    await expect(dialog).not.toBeVisible()
    await expect(setup.locator('[data-step="ausweis"]')).toHaveClass(/done/)
  })
})
