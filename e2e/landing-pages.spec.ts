import { countEntities, expect, test } from './fixtures/test-fixtures'

// Landing Pages für die Validierung (business-plan/09-validierung.md, M3):
// eine Seite pro Hypothese, Preis sichtbar, ein Button, Formular mit E-Mail-Feld, kein Zahlungsvorgang.
test.describe('Landing Pages', () => {
  test('LP-001: Betrieb zeigt Problem, Nutzen, Preis und Frühzugang-Button', async ({ page }) => {
    await page.goto('/betrieb')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Firmenfahrzeuge')
    // dieselbe Preistabelle wie für Privathalter: Stufen plus Regler
    const table = page.getByRole('table', { name: 'Preisliste' })
    await expect(table.getByRole('row').filter({ hasText: /^10\s*CHF/ })).toContainText('CHF 252.00')
    await expect(table.getByRole('row').filter({ hasText: /^3\s*CHF/ })).toContainText('CHF 84.00')
    // Regler startet bei fünf Fahrzeugen: 36 + 4 × 24 = 132
    await expect(page.getByTestId('price-result')).toContainText('CHF 132.00 im Jahr')
    await expect(page.getByRole('button', { name: '30 Tage gratis testen' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Wir richten es für dich ein' })).toBeVisible()
    await expect(page.getByText(/ersten drei Betriebe/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Impressum' })).toBeVisible()
  })

  test('LP-002: Privathalter zeigt Jahrespreis und Vorbestell-Button', async ({ page }) => {
    await page.goto('/privathalter')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText('36 CHF im Jahr')).toBeVisible()
    await expect(page.getByRole('button', { name: '30 Tage gratis testen' })).toBeVisible()
  })

  // Leads werden zwischen Tests nicht gelöscht (Formular ohne Login), deshalb Differenz statt Absolutwert
  test('LP-003: Frühzugang-Formular speichert einen Lead', async ({ page }) => {
    await page.goto('/betrieb')
    const before = await countEntities(page, 'leads')
    await page.getByRole('button', { name: 'Wir richten es für dich ein' }).click()
    await page.getByLabel('E-Mail').fill('inhaber@muster-sanitaer.ch')
    await page.getByLabel('Anzahl Fahrzeuge').fill('6')
    await page.getByRole('button', { name: 'Absenden' }).click()
    await expect(page.getByText('Danke, wir melden uns per E-Mail.')).toBeVisible()
    expect(await countEntities(page, 'leads')).toBe(before + 1)
  })

  test('LP-004: ungültige E-Mail wird nicht gespeichert', async ({ page }) => {
    // Das Lead-Formular gibt es nur noch bei Betrieben (Einrichtung durch uns); Private testen direkt
    await page.goto('/betrieb')
    const before = await countEntities(page, 'leads')
    await page.getByRole('button', { name: 'Wir richten es für dich ein' }).click()
    await page.getByLabel('E-Mail').fill('keine-adresse')
    await page.getByRole('button', { name: 'Absenden' }).click()
    await expect(page.getByText('Bitte eine gültige E-Mail-Adresse angeben.')).toBeVisible()
    expect(await countEntities(page, 'leads')).toBe(before)
  })

  // Die Links der Startseite auf /betrieb und /privathalter sind hier nicht prüfbar: im lokalen Modus ist
  // der Nutzer immer eingeloggt und / leitet auf /dashboard um (PP-004).
})
