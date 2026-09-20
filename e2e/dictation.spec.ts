import type { Page } from '@playwright/test'
import { clearInstantDB, expect, mockInvoiceScan, test, waitForInstantDB } from './fixtures/test-fixtures'

// Diktieren statt tippen (useDictation.ts, DictateButton.vue): Chat-Eingabe, Freitextfeld im Wartungsformular
// und die ganze Rechnung ansagen. Playwright liefert einen Fake-Mikrofonstrom, die Erkennung fängt die Route ab.

async function mockTranscript(page: Page, text: string) {
  await page.route('**/localhost:8787/me/transcribe', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text }) })
  })
}

/** Aufnahme starten, kurz laufen lassen, stoppen — der Knopf schaltet um */
async function diktieren(knopf: any, page: Page) {
  await knopf.click()
  await page.waitForTimeout(900)
  await knopf.click()
}

test.describe('Diktieren', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('DI-001: Chat-Eingabe wird diktiert, abgeschickt wird von Hand', async ({ page }) => {
    await mockTranscript(page, 'Wann ist der nächste Service fällig?')
    await page.goto('/dashboard')
    await page.locator('.chat-fab').click()

    const knopf = page.getByTestId('dictate-button').first()
    await expect(knopf).toBeVisible()
    await diktieren(knopf, page)

    await expect(page.locator('.chat-input')).toHaveValue('Wann ist der nächste Service fällig?')
  })

  test('DI-002: Beschreibung im Wartungsformular diktieren', async ({ page }) => {
    await mockTranscript(page, 'Bremsbeläge vorne ersetzt und Bremsflüssigkeit gewechselt.')
    await page.goto('/')
    await waitForInstantDB(page)
    await page.evaluate(async () => {
      const { db, tx, id: genId } = (window as any).__instantdb
      const now = new Date().toISOString()
      await db.transact(tx.vehicles[genId()].update({ make: 'VW', model: 'Golf', year: 2016, mileage: 118400, licensePlate: 'SG 1', createdAt: now, updatedAt: now }))
    })
    await page.goto('/vehicles')
    await page.locator('.vehicle-card').first().click()
    await page.waitForURL(/\/vehicles\/.+/)
    await page.getByRole('tab', { name: 'Verlauf' }).click()
    await page.getByRole('button', { name: /Wartung hinzufügen/ }).click()

    const dialog = page.getByRole('dialog')
    await diktieren(dialog.getByTestId('dictate-button').first(), page)
    await expect(dialog.locator('#maintenance-description')).toHaveValue(/Bremsbeläge vorne ersetzt/)
  })

  test('DI-003: ganze Rechnung ansagen füllt die Felder', async ({ page }) => {
    await mockTranscript(page, 'Rechnung von der Garage Hubmann vom 14. September 2026, Betrag 486.50, Kilometerstand 118400.')
    // Die Auswertung der Ansage läuft über dieselbe Stufe wie beim Foto, darum derselbe Mock
    await mockInvoiceScan(page, {
      photos: [{ workshopName: 'Garage Hubmann', date: '2026-09-14', totalAmount: 486.5, currency: 'CHF', mileageAtService: 118400, items: [] }],
    })

    await page.goto('/')
    await waitForInstantDB(page)
    await page.evaluate(async () => {
      const { db, tx, id: genId } = (window as any).__instantdb
      const now = new Date().toISOString()
      await db.transact(tx.vehicles[genId()].update({ make: 'VW', model: 'Golf', year: 2016, mileage: 118400, licensePlate: 'SG 1', createdAt: now, updatedAt: now }))
    })
    await page.goto('/vehicles')
    await page.locator('.vehicle-card').first().click()
    await page.waitForURL(/\/vehicles\/.+/)
    await page.getByRole('tab', { name: 'Rechnungen' }).click()
    await page.getByRole('button', { name: /Rechnung hinzufügen/ }).click()

    const dialog = page.getByRole('dialog')
    await diktieren(dialog.getByTestId('dictate-button').first(), page)
    await expect(dialog.locator('#invoice-workshop')).toHaveValue('Garage Hubmann', { timeout: 20_000 })
  })
})
