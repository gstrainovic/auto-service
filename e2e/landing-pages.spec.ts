import { expect, test } from './fixtures/test-fixtures'

// Landing Pages für die Validierung (business-plan/09-validierung.md, M2):
// eine Seite pro Hypothese, Preis sichtbar, ein Button in die Testzeit, Fragen per Mail ans Postfach.
test.describe('Landing Pages', () => {
  // Abgemeldet und unbekanntes Gerät: so sieht ein neuer Besucher die Seite (siehe auth-entry.spec.ts)
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('auth:localSignedOut', '1')
      localStorage.removeItem('auth:knownEmail')
    })
  })

  test('LP-001: Betrieb zeigt Problem, Nutzen, Preis, Test-Button und Kontaktadresse', async ({ page }) => {
    await page.goto('/betrieb')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Firmenfahrzeuge')
    // Betriebsliste: 36 CHF pro Fahrzeug und Jahr, Stufen plus Regler, kein Umschalter
    await expect(page.getByTestId('price-betrieb')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Privat' })).toHaveCount(0)
    const table = page.getByRole('table', { name: 'Preisliste' })
    await expect(table.getByRole('row').filter({ hasText: /^10\s*CHF/ })).toContainText('CHF 360.00')
    await expect(table.getByRole('row').filter({ hasText: /^3\s*CHF/ })).toContainText('CHF 108.00')
    // Regler startet bei fünf Fahrzeugen: 5 × 36 = 180
    await expect(page.getByTestId('price-result')).toContainText('CHF 180.00 im Jahr')
    // Hauptknopf beim Preis, im Kopf derselbe Knopf neben «Anmelden»
    await expect(page.getByRole('main').getByRole('button', { name: '30 Tage gratis testen' })).toBeVisible()
    await expect(page.getByRole('banner').getByRole('button', { name: '30 Tage gratis testen' })).toBeVisible()
    await expect(page.getByRole('banner').getByRole('link', { name: 'Anmelden' })).toBeVisible()
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
    // Privatliste: ein Preis bis fünf Fahrzeuge, keine Tabelle
    await expect(page.getByText('25 CHF im Jahr, bis 5 Fahrzeuge')).toBeVisible()
    await expect(page.getByTestId('price-privat')).toBeVisible()
    await expect(page.getByRole('table', { name: 'Preisliste' })).toHaveCount(0)
    await expect(page.getByRole('main').getByRole('button', { name: '30 Tage gratis testen' })).toBeVisible()
    await expect(page.getByRole('banner').getByRole('button', { name: '30 Tage gratis testen' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'info@wartungsheft.ch' })).toBeVisible()
  })

  test('LP-004: der Film steht auf Startseite und Angebotsseiten, stumm und erst auf Klick', async ({ page }) => {
    // Breiter Bildschirm: Querformat, damit das Hochformat nicht die halbe Seite füllt
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/')
    const film = page.getByTestId('landing-video')
    await expect(film).toBeVisible()
    const video = film.locator('video')
    await expect(video).toHaveAttribute('src', '/film-privat-quer.webm')
    await expect(video).toHaveAttribute('poster', '/film-privat-quer-poster.jpg')

    // Handy: hochkant
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(video).toHaveAttribute('src', '/film-privat.webm')
    expect(await video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true)
    // Kein Autoplay: erst der Knopf startet
    await expect(film.getByRole('button', { name: 'Film abspielen' })).toBeVisible()
    expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true)

    await page.goto('/betrieb')
    await expect(page.getByTestId('landing-video').locator('video')).toHaveAttribute('src', '/film-betrieb.webm')
    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(page.getByTestId('landing-video').locator('video')).toHaveAttribute('src', '/film-betrieb-quer.webm')
  })
})
