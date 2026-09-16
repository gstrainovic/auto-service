import { expect, test } from './fixtures/test-fixtures'

// Landing Pages für die Validierung (business-plan/09-validierung.md, M3):
// eine Seite pro Hypothese, Preis sichtbar, ein Button in die Testzeit, Fragen per Mail ans Postfach.
test.describe('Landing Pages', () => {
  test('LP-001: Betrieb zeigt Problem, Nutzen, Preis, Test-Button und Kontaktadresse', async ({ page }) => {
    await page.goto('/betrieb')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Firmenfahrzeuge')
    // dieselbe Preistabelle wie für Privathalter: Stufen plus Regler
    const table = page.getByRole('table', { name: 'Preisliste' })
    await expect(table.getByRole('row').filter({ hasText: /^10\s*CHF/ })).toContainText('CHF 252.00')
    await expect(table.getByRole('row').filter({ hasText: /^3\s*CHF/ })).toContainText('CHF 84.00')
    // Regler startet bei fünf Fahrzeugen: 36 + 4 × 24 = 132
    await expect(page.getByTestId('price-result')).toContainText('CHF 132.00 im Jahr')
    // Hauptknopf beim Preis; im Kopf derselbe Knopf, der im lokalen Modus (immer eingeloggt) «Zur Übersicht» heisst
    await expect(page.getByRole('main').getByRole('button', { name: '30 Tage gratis testen' })).toBeVisible()
    await expect(page.getByRole('banner').getByRole('button', { name: /30 Tage gratis testen|Zur Übersicht/ })).toBeVisible()
    // Kontakt statt Formular: Mail-Link mit Betreff unter dem Knopf, Adresse auch im Footer
    const contact = page.getByRole('link', { name: 'info@wartungsheft.ch' })
    await expect(contact).toHaveCount(2)
    await expect(contact.first()).toHaveAttribute('href', /^mailto:info@wartungsheft\.ch\?subject=/)
    await expect(page.getByText('Team-Adresse')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Impressum' })).toBeVisible()
  })

  test('LP-002: Privathalter zeigt Jahrespreis und Test-Button', async ({ page }) => {
    await page.goto('/privathalter')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText('36 CHF im Jahr')).toBeVisible()
    await expect(page.getByRole('main').getByRole('button', { name: '30 Tage gratis testen' })).toBeVisible()
    await expect(page.getByRole('banner').getByRole('button', { name: /30 Tage gratis testen|Zur Übersicht/ })).toBeVisible()
    await expect(page.getByRole('link', { name: 'info@wartungsheft.ch' })).toBeVisible()
  })

  // Die Links der Startseite auf /betrieb und /privathalter sind hier nicht prüfbar: im lokalen Modus ist
  // der Nutzer immer eingeloggt und / leitet auf /dashboard um (PP-004).
})
