/**
 * Clips für den Werbefilm «Privathalter» (Drehbuch: video-scripts/privat-video-script.md).
 * Aufnahme: `npm run video -- e2e/video/privat.video.ts`, Ergebnis unter test-results/…/video.webm.
 * Jede Szene ist ein eigener Clip, damit der Schnitt sie einzeln kürzen und umstellen kann.
 */
import { clearInstantDB, expect, mockInvoiceScan, test, waitForInstantDB } from '../fixtures/test-fixtures'
import { beat, clipSpeichern, daysAgo, musterRechnungFoto, seed, showPointer, slowClick } from './szenen'

const GOLF = { make: 'VW', model: 'Golf 7', year: 2016, mileage: 118_400, licensePlate: 'SG 248 901' }
// Erfundener Name: im Film darf keine echte Werkstatt vorkommen
const WERKSTATT = 'Muster-Garage AG'

test.describe('Werbeclips Privathalter', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test.afterEach(async ({ page }, testInfo) => {
    await clipSpeichern(page, testInfo)
  })

  test('Szene 2: Rechnung fotografieren, Felder füllen sich', async ({ page, browser }, testInfo) => {
    await seed(page, { vehicles: [GOLF] })
    // Bild und Scan-Ergebnis zeigen dasselbe: erfundene Muster-Garage, derselbe Wagen, dieselben Beträge
    const foto = await musterRechnungFoto(browser, testInfo, {
      werkstatt: WERKSTATT,
      adresse: 'Musterstrasse 12, 9999 Musterhausen',
      datum: daysAgo(3),
      fahrzeug: 'VW Golf 7',
      kontrollschild: GOLF.licensePlate,
      kilometer: 118_400,
      positionen: [{ text: 'Motoröl und Ölfilter', betrag: 189 }, { text: 'Bremsbeläge vorne', betrag: 297.5 }],
    })
    await mockInvoiceScan(page, {
      photos: [{
        workshopName: WERKSTATT,
        date: daysAgo(3),
        totalAmount: 486.5,
        currency: 'CHF',
        mileageAtService: 118_400,
        items: [
          { description: 'Motoröl und Ölfilter', category: 'oelwechsel', amount: 189 },
          { description: 'Bremsbeläge vorne', category: 'bremsen', amount: 297.5 },
        ],
      }],
    })
    await page.goto('/vehicles')
    await showPointer(page)
    await beat(page)

    await slowClick(page, page.locator('.vehicle-card').first())
    await page.waitForURL(/\/vehicles\/.+/)
    await beat(page)

    await slowClick(page, page.getByRole('tab', { name: 'Rechnungen' }))
    await slowClick(page, page.getByRole('button', { name: /Rechnung hinzufügen/ }))
    await beat(page)

    // Foto der Rechnung: der Scan füllt Werkstatt, Datum, Betrag, Kilometerstand und die Positionen.
    // InputNumber verknüpft sein Label über input-id, darum hier die IDs statt getByLabel.
    await page.setInputFiles('input[type="file"]', foto)
    await expect(page.locator('#invoice-workshop')).toHaveValue(WERKSTATT, { timeout: 20_000 })
    await beat(page, 2)

    await page.locator('#invoice-amount').scrollIntoViewIfNeeded()
    await beat(page, 2)
    await page.locator('.scan-items').scrollIntoViewIfNeeded()
    await beat(page, 3)
  })

  test('Szene 3: Fälligkeit auf dem Dashboard und erledigt eintragen', async ({ page }) => {
    await seed(page, {
      vehicles: [{ ...GOLF, mileage: 129_600 }],
      maintenances: [
        { vehicleIndex: 0, type: 'oelwechsel', description: 'Motoröl und Filter', doneAt: daysAgo(400), mileageAtService: 114_000 },
        { vehicleIndex: 0, type: 'bremsen', description: 'Bremsbeläge vorne', doneAt: daysAgo(120), mileageAtService: 126_000 },
      ],
    })
    await page.goto('/dashboard')
    await showPointer(page)
    await beat(page, 2)

    // Fälligkeitsliste oben: was ansteht, ohne Suchen
    await page.mouse.move(195, 320)
    await beat(page, 2)
    await page.mouse.wheel(0, 260)
    await beat(page, 2)

    const done = page.getByRole('button', { name: 'Erledigt eintragen' }).first()
    if (await done.count()) {
      await slowClick(page, done)
      await beat(page, 2)
    }
  })

  test('Szene 4: Kosten und PDF-Dossier für den Verkauf', async ({ page }) => {
    await seed(page, {
      vehicles: [GOLF],
      invoices: [
        { vehicleIndex: 0, workshopName: WERKSTATT, date: daysAgo(30), totalAmount: 486.5, mileageAtService: 118_400, items: [{ description: 'Motoröl und Ölfilter', category: 'oelwechsel', amount: 189 }, { description: 'Bremsbeläge vorne', category: 'bremsen', amount: 297.5 }] },
        { vehicleIndex: 0, workshopName: 'Muster-Pneu GmbH', date: daysAgo(210), totalAmount: 612, mileageAtService: 112_800, items: [{ description: 'Winterreifen montiert', category: 'reifen', amount: 612 }] },
        { vehicleIndex: 0, workshopName: WERKSTATT, date: daysAgo(400), totalAmount: 1240.8, mileageAtService: 104_500, items: [{ description: 'Grosser Service', category: 'inspektion', amount: 890 }, { description: 'Zündkerzen', category: 'zuendung', amount: 350.8 }] },
      ],
    })
    await page.goto('/vehicles')
    await showPointer(page)
    await slowClick(page, page.locator('.vehicle-card').first())
    await page.waitForURL(/\/vehicles\/.+/)

    await slowClick(page, page.getByRole('tab', { name: 'Kosten' }))
    await beat(page, 2)
    await page.mouse.wheel(0, 300)
    await beat(page, 2)

    // Dossier als PDF: derselbe Knopf, den ein Verkäufer vor der Besichtigung drückt
    const pdf = page.getByRole('button', { name: /PDF/ }).first()
    if (await pdf.count()) {
      await pdf.hover()
      await beat(page, 2)
    }
  })

  test('Szene 5: Preis und Testzeit in den Einstellungen', async ({ page }) => {
    await seed(page, { vehicles: [GOLF] })
    await page.goto('/settings')
    await waitForInstantDB(page)
    await showPointer(page)
    await beat(page)
    const card = page.locator('.settings-card', { hasText: 'Abo & Nutzung' })
    await card.scrollIntoViewIfNeeded()
    await beat(page, 3)
  })
})
