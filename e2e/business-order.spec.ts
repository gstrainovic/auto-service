import type { Page } from '@playwright/test'
import { clearInstantDB, expect, test, waitForInstantDB } from './fixtures/test-fixtures'

// Jahresabo auf Rechnung, privat oder für einen Betrieb: Bestellung in den Einstellungen mit Rechnungsadresse,
// Fahrzeugzahl vorbelegt mit den aktiven Fahrzeugen, Rechnung zahlbar in 30 Tagen, kündbar bis zum Ablauf.
// Der lokale Proxy läuft wie die Produktion ohne IBAN und ohne RESEND_TOKEN: Rechnung von Hand, der Auftrag an
// info@wartungsheft.ch wird nur protokolliert.

async function seedVehicles(page: Page) {
  await page.goto('/')
  await waitForInstantDB(page)
  await page.evaluate(async () => {
    const { db, tx, id: genId } = (window as any).__instantdb
    const now = new Date().toISOString()
    await db.transact([
      tx.vehicles[genId()].update({ make: 'Fiat', model: 'Ducato', year: 2018, mileage: 0, licensePlate: 'SG 1', createdAt: now, updatedAt: now }),
      tx.vehicles[genId()].update({ make: 'VW', model: 'Caddy', year: 2020, mileage: 0, licensePlate: 'SG 2', createdAt: now, updatedAt: now }),
      tx.vehicles[genId()].update({ make: 'Opel', model: 'Vivaro', year: 2012, mileage: 0, licensePlate: 'SG 3', soldAt: '2026-01-10', createdAt: now, updatedAt: now }),
    ])
  })
}

test.describe('Jahresabo auf Rechnung', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('BO-001: Betrieb bestellt mit Rechnungsadresse, sieht Rechnung und kann kündigen', async ({ page }) => {
    await seedVehicles(page)
    await page.goto('/settings')
    const card = page.locator('.settings-card', { hasText: 'Abo & Nutzung' })
    await card.getByRole('button', { name: 'Jahresabo bestellen' }).click()

    const dialog = page.getByTestId('business-order-dialog')
    await dialog.getByRole('button', { name: 'Betrieb' }).click()
    // Zwei aktive Fahrzeuge, das verkaufte zählt nicht
    await expect(dialog.getByLabel('Anzahl Fahrzeuge')).toHaveValue('2')
    await expect(dialog.getByTestId('order-price')).toContainText('CHF 72.00 im Jahr')
    await dialog.getByLabel('Anzahl Fahrzeuge').fill('3')
    await expect(dialog.getByTestId('order-price')).toContainText('CHF 108.00 im Jahr')

    await dialog.getByLabel('Firma').fill('Muster Sanitär AG')
    await dialog.getByLabel('Kontaktperson').fill('Petra Muster')
    await dialog.getByLabel('Strasse und Nummer').fill('Hauptstrasse 12')
    await dialog.getByLabel('PLZ').fill('9000')
    await dialog.getByLabel('Ort').fill('St. Gallen')
    await dialog.getByLabel('E-Mail für die Rechnung').fill('buchhaltung@muster.ch')
    await dialog.getByLabel('Deine Referenz (optional)').fill('KST 4711')

    // AGB aus dem Dialog erreichbar, in neuem Tab, damit das Formular stehen bleibt
    await expect(dialog.getByRole('link', { name: 'AGB' })).toHaveAttribute('href', '/agb')
    await expect(dialog.getByRole('link', { name: 'AGB' })).toHaveAttribute('target', '_blank')

    // Ohne Zustimmung keine Bestellung
    await dialog.getByRole('button', { name: 'Kostenpflichtig bestellen' }).click()
    await expect(dialog.getByText('Bitte den Bedingungen zustimmen.')).toBeVisible()

    await dialog.getByLabel(/verlängert sich jährlich/).check()
    await dialog.getByRole('button', { name: 'Kostenpflichtig bestellen' }).click()
    await expect(dialog).not.toBeVisible()
    // Ohne IBAN schreibt der Betreiber die Rechnung von Hand: kein Versprechen einer QR-Rechnung, die schon unterwegs ist
    await expect(page.getByText('Die Rechnung kommt in den nächsten Tagen per Mail.', { exact: false })).toBeVisible()

    const status = card.getByTestId('business-subscription')
    await expect(status).toContainText('Jahresabo Betrieb')
    await expect(status).toContainText('Muster Sanitär AG')
    await expect(status).toContainText('3 Fahrzeuge')
    await expect(status).toContainText(/Rechnung WH-\d{8}-[0-9A-Z]{6} über CHF 108\.00, zahlbar bis \d{2}\.\d{2}\.\d{4}/)
    await expect(status).toContainText('verlängert sich automatisch')
    await expect(card.getByRole('button', { name: 'Jahresabo bestellen' })).toHaveCount(0)

    // Bestellt während der Testzeit: das bezahlte Jahr hat noch nicht begonnen, Kündigung storniert die Rechnung
    // (Kündigung auf Ende einer laufenden Laufzeit prüfen die Unit-Tests im ai-proxy)
    await status.getByRole('button', { name: 'Abo kündigen' }).click()
    await expect(page.getByText('Die Rechnung ist storniert, du musst nichts bezahlen.')).toBeVisible()
    await expect(status).toHaveCount(0)
    await expect(card.getByRole('button', { name: 'Jahresabo bestellen' })).toBeVisible()
  })

  test('BO-002: fehlerhafte Angaben zeigt das Formular am Feld', async ({ page }) => {
    await seedVehicles(page)
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Jahresabo bestellen' }).click()
    const dialog = page.getByTestId('business-order-dialog')
    await dialog.getByRole('button', { name: 'Betrieb' }).click()
    await dialog.getByLabel('Firma').fill('Muster AG')
    await dialog.getByLabel('Kontaktperson').fill('Petra Muster')
    await dialog.getByLabel('Strasse und Nummer').fill('Hauptstrasse 12')
    await dialog.getByLabel('PLZ').fill('90')
    await dialog.getByLabel('Ort').fill('St. Gallen')
    await dialog.getByLabel('E-Mail für die Rechnung').fill('buchhaltung@muster.ch')
    await dialog.getByLabel(/verlängert sich jährlich/).check()
    await dialog.getByRole('button', { name: 'Kostenpflichtig bestellen' }).click()
    await expect(dialog.getByText('PLZ mit vier Ziffern angeben.')).toBeVisible()
    await expect(dialog).toBeVisible()
  })

  test('BO-003: Privatkunde bestellt ohne Firma, 25 CHF im Jahr', async ({ page }) => {
    await seedVehicles(page)
    await page.goto('/settings')
    const card = page.locator('.settings-card', { hasText: 'Abo & Nutzung' })
    await card.getByRole('button', { name: 'Jahresabo bestellen' }).click()

    const dialog = page.getByTestId('business-order-dialog')
    // Privat ist voreingestellt: kein Firmenfeld, ein Preis fürs Konto
    await expect(dialog.getByLabel('Firma')).toHaveCount(0)
    await expect(dialog.getByTestId('order-price')).toContainText('CHF 25.00 im Jahr')

    await dialog.getByLabel('Name').fill('Anna Beispiel')
    await dialog.getByLabel('Strasse und Nummer').fill('Dorfstrasse 4')
    await dialog.getByLabel('PLZ').fill('9000')
    await dialog.getByLabel('Ort').fill('St. Gallen')
    await dialog.getByLabel('E-Mail für die Rechnung').fill('anna@beispiel.ch')
    await dialog.getByLabel(/verlängert sich jährlich/).check()
    await dialog.getByRole('button', { name: 'Kostenpflichtig bestellen' }).click()
    await expect(dialog).not.toBeVisible()

    const status = card.getByTestId('business-subscription')
    await expect(status).toContainText('Jahresabo Privat')
    await expect(status).toContainText('Anna Beispiel')
    await expect(status).toContainText(/über CHF 25\.00/)
  })

  test('BO-004: privat über fünf Fahrzeuge rechnet pro Fahrzeug ab', async ({ page }) => {
    await seedVehicles(page)
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Jahresabo bestellen' }).click()
    const dialog = page.getByTestId('business-order-dialog')
    await dialog.getByLabel('Anzahl Fahrzeuge').fill('6')
    await expect(dialog.getByTestId('order-price')).toContainText('CHF 216.00 im Jahr')
    await expect(dialog.getByText(/Über 5 Fahrzeuge gilt der Preis pro Fahrzeug/)).toBeVisible()
  })
})
