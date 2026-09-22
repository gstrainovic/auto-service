/**
 * Clips für den Werbefilm «Betrieb» (Drehbuch: video-scripts/betrieb-video-script.md).
 * Aufnahme: `npm run video -- e2e/video/betrieb.video.ts`, Ergebnis unter test-results/…/video.webm.
 */
import { clearInstantDB, expect, mockInvoiceScan, test } from '../fixtures/test-fixtures'
import { beat, clipSpeichern, daysAgo, seed, showPointer, slowClick } from './szenen'

const FLEET = [
  { make: 'Fiat', model: 'Ducato', year: 2019, mileage: 184_300, licensePlate: 'SG 41 220' },
  { make: 'VW', model: 'Caddy Cargo', year: 2021, mileage: 96_800, licensePlate: 'SG 41 221' },
  { make: 'Renault', model: 'Master', year: 2017, mileage: 241_500, licensePlate: 'SG 41 222' },
  { make: 'Ford', model: 'Transit Custom', year: 2022, mileage: 61_200, licensePlate: 'SG 41 223' },
]

test.describe('Werbeclips Betrieb', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test.afterEach(async ({ page }, testInfo) => {
    await clipSpeichern(page, testInfo)
  })

  test('Szene 2: Fuhrpark auf einen Blick, was ist fällig', async ({ page }) => {
    await seed(page, {
      vehicles: FLEET,
      maintenances: [
        { vehicleIndex: 0, type: 'oelwechsel', description: 'Motoröl und Filter', doneAt: daysAgo(430), mileageAtService: 170_000 },
        { vehicleIndex: 1, type: 'oelwechsel', description: 'Motoröl und Filter', doneAt: daysAgo(90), mileageAtService: 92_000 },
        { vehicleIndex: 2, type: 'bremsen', description: 'Bremsscheiben hinten', doneAt: daysAgo(500), mileageAtService: 220_000 },
        { vehicleIndex: 3, type: 'inspektion', description: 'Service nach Plan', doneAt: daysAgo(60), mileageAtService: 58_000 },
      ],
    })
    await page.goto('/dashboard')
    await showPointer(page)
    await beat(page, 2)
    await page.mouse.wheel(0, 240)
    await beat(page, 3)
    await page.mouse.wheel(0, 320)
    await beat(page, 2)
  })

  test('Szene 3: Rechnung vom Fahrer, ein Foto genügt', async ({ page }) => {
    await seed(page, { vehicles: FLEET })
    await mockInvoiceScan(page, {
      photos: [{
        workshopName: 'Nutzfahrzeuge Brunner AG',
        date: daysAgo(1),
        totalAmount: 1287.4,
        currency: 'CHF',
        mileageAtService: 184_300,
        items: [
          { description: 'Service 180 000 km', category: 'inspektion', amount: 740 },
          { description: 'Bremsbeläge hinten', category: 'bremsen', amount: 547.4 },
        ],
      }],
    })
    await page.goto('/vehicles')
    await showPointer(page)
    await slowClick(page, page.locator('.vehicle-card').first())
    await page.waitForURL(/\/vehicles\/.+/)
    await slowClick(page, page.getByRole('tab', { name: 'Rechnungen' }))
    await slowClick(page, page.getByRole('button', { name: /Rechnung hinzufügen/ }))

    await page.setInputFiles('input[type="file"]', 'testdateien/test-invoice.png')
    await expect(page.locator('#invoice-workshop')).toHaveValue(/Brunner/, { timeout: 20_000 })
    await beat(page, 2)
    await page.locator('.scan-items').scrollIntoViewIfNeeded()
    await beat(page, 3)
  })

  test('Szene 4: Kosten pro Fahrzeug und Jahr, Export für die Buchhaltung', async ({ page }) => {
    await seed(page, {
      vehicles: FLEET,
      // dieselben Wartungen wie in Szene 2: sonst meldet das Dashboard «nichts fällig» und widerspricht dem Film
      maintenances: [
        { vehicleIndex: 0, type: 'oelwechsel', description: 'Motoröl und Filter', doneAt: daysAgo(430), mileageAtService: 170_000 },
        { vehicleIndex: 1, type: 'oelwechsel', description: 'Motoröl und Filter', doneAt: daysAgo(90), mileageAtService: 92_000 },
        { vehicleIndex: 2, type: 'bremsen', description: 'Bremsscheiben hinten', doneAt: daysAgo(500), mileageAtService: 220_000 },
        { vehicleIndex: 3, type: 'inspektion', description: 'Service nach Plan', doneAt: daysAgo(60), mileageAtService: 58_000 },
      ],
      invoices: [
        { vehicleIndex: 0, workshopName: 'Nutzfahrzeuge Brunner AG', date: daysAgo(20), totalAmount: 1287.4, mileageAtService: 184_300, items: [{ description: 'Service 180 000 km', category: 'inspektion', amount: 740 }, { description: 'Bremsbeläge hinten', category: 'bremsen', amount: 547.4 }] },
        { vehicleIndex: 1, workshopName: 'Garage Hubmann, Rorschach', date: daysAgo(70), totalAmount: 468.9, mileageAtService: 94_100, items: [{ description: 'Ölservice', category: 'oelwechsel', amount: 468.9 }] },
        { vehicleIndex: 2, workshopName: 'Pneuhaus Egger', date: daysAgo(140), totalAmount: 1980, mileageAtService: 238_000, items: [{ description: 'Vier Reifen', category: 'reifen', amount: 1980 }] },
        { vehicleIndex: 3, workshopName: 'Nutzfahrzeuge Brunner AG', date: daysAgo(310), totalAmount: 655.2, mileageAtService: 52_400, items: [{ description: 'Erster Service', category: 'inspektion', amount: 655.2 }] },
      ],
    })
    await page.goto('/dashboard')
    await showPointer(page)
    await beat(page, 2)
    // langsam zur Fuhrpark-Tabelle: der Ausschnitt im Film beginnt erst nach dem Seitenaufbau
    await page.mouse.wheel(0, 450)
    await beat(page, 2)
    await page.mouse.wheel(0, 450)
    await beat(page, 3)

    const csv = page.getByRole('button', { name: /CSV/ }).first()
    if (await csv.count()) {
      await csv.hover()
      await beat(page, 2)
    }
    await beat(page, 2)
  })

  test('Szene 5: Bestellung mit Rechnung auf die Firma', async ({ page }) => {
    await seed(page, { vehicles: FLEET })
    await page.goto('/settings')
    await showPointer(page)
    const card = page.locator('.settings-card', { hasText: 'Abo & Nutzung' })
    await card.scrollIntoViewIfNeeded()
    await beat(page, 2)

    const order = card.getByRole('button', { name: 'Jahresabo bestellen' })
    if (await order.count()) {
      await slowClick(page, order)
      const dialog = page.getByTestId('business-order-dialog')
      await slowClick(page, dialog.getByRole('button', { name: 'Betrieb' }))
      await beat(page, 2)
      // Fahrzeugzahl ist vorbelegt, der Preis steht sofort da
      await dialog.getByTestId('order-price').scrollIntoViewIfNeeded()
      await beat(page, 3)
    }
  })
})
