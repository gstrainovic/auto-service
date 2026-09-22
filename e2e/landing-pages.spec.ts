import { PAGE_META, SITE_URL } from '../src/lib/page-meta'
import { expect, test } from './fixtures/test-fixtures'

// Events darf der Client nicht lesen, darum zählt der Test über die Admin-API
async function countEvents(match: Record<string, string>) {
  const res = await fetch(`${process.env.INSTANT_API_URI}/admin/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'App-Id': process.env.INSTANT_APP_ID!,
      'Authorization': `Bearer ${process.env.INSTANT_ADMIN_TOKEN}`,
    },
    body: JSON.stringify({ query: { events: {} } }),
  })
  const { events } = await res.json() as { events: Record<string, string>[] }
  return events.filter(e => Object.entries(match).every(([k, v]) => e[k] === v)).length
}

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
    // Die erste Spalte nennt die Einheit, eine nackte 3 sagt dem Leser nichts
    await expect(table.getByRole('row').filter({ hasText: '10 Fahrzeuge' })).toContainText('CHF 360.00')
    await expect(table.getByRole('row').filter({ hasText: '3 Fahrzeuge' })).toContainText('CHF 108.00')
    await expect(table.getByRole('row').filter({ hasText: '1 Fahrzeug' }).first()).toContainText('CHF 36.00')
    // Die Testzeit ist keine Fahrzeugzahl und steht darum nicht in der Tabelle
    await expect(table).not.toContainText('30 Tage')
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

  test('LP-005: Preisliste passt auf 390px, ohne abgeschnittene Spalte', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/betrieb')
    const table = page.getByRole('table', { name: 'Preisliste' })
    await expect(table).toBeVisible()
    // Auf dem Handy bleibt die Jahresspalte, die Monatsspalte steht im Rechner darunter
    await expect(table.getByRole('columnheader', { name: 'pro Jahr' })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: 'pro Monat' })).toBeHidden()
    const ueberbreite = await table.evaluate(el => el.scrollWidth - el.clientWidth)
    expect(ueberbreite).toBeLessThanOrEqual(1)
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

  test('LP-006: jede Einstiegsseite hat eigenen Titel, kanonische Adresse und «Serviceheft» in der Hauptüberschrift', async ({ page }) => {
    for (const path of ['/', '/privathalter', '/betrieb', '/hilfe']) {
      await page.goto(path)
      await expect(page).toHaveTitle(PAGE_META[path]!.title)
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', PAGE_META[path]!.description)
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${SITE_URL}${path}`)
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Serviceheft')
    }
  })

  test('LP-007: /tcs aus dem Inserat zählt den Besuch, zeigt die Privathalter-Seite und markiert den Testklick', async ({ page }) => {
    const visits = await countEvents({ name: 'visit', campaign: 'tcs' })
    const clicks = await countEvents({ name: 'cta_click', segment: 'privathalter', campaign: 'tcs' })

    await page.goto('/tcs')
    await expect(page).toHaveURL(/\/privathalter$/)
    await expect(page.getByText('25 CHF im Jahr, bis 5 Fahrzeuge')).toBeVisible()
    await expect.poll(() => countEvents({ name: 'visit', campaign: 'tcs' })).toBe(visits + 1)

    await page.getByRole('main').getByRole('button', { name: '30 Tage gratis testen' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect.poll(() => countEvents({ name: 'cta_click', segment: 'privathalter', campaign: 'tcs' })).toBe(clicks + 1)
  })

  test('LP-008: /google aus der Anzeige zählt den Besuch, zeigt die Betriebsseite und markiert den Testklick', async ({ page }) => {
    const visits = await countEvents({ name: 'visit', campaign: 'google' })
    const clicks = await countEvents({ name: 'cta_click', segment: 'betrieb', campaign: 'google' })

    await page.goto('/google')
    await expect(page).toHaveURL(/\/betrieb$/)
    await expect(page.getByTestId('price-betrieb')).toBeVisible()
    await expect.poll(() => countEvents({ name: 'visit', campaign: 'google' })).toBe(visits + 1)

    await page.getByRole('main').getByRole('button', { name: '30 Tage gratis testen' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect.poll(() => countEvents({ name: 'cta_click', segment: 'betrieb', campaign: 'google' })).toBe(clicks + 1)
  })

  test('LP-009: /google-privat aus der Anzeige für Privathalter zählt den Besuch und zeigt die Privathalter-Seite', async ({ page }) => {
    const visits = await countEvents({ name: 'visit', campaign: 'google-privat' })
    await page.goto('/google-privat')
    await expect(page).toHaveURL(/\/privathalter$/)
    await expect(page.getByTestId('price-privat')).toBeVisible()
    await expect.poll(() => countEvents({ name: 'visit', campaign: 'google-privat' })).toBe(visits + 1)
  })

  test('LP-004: der Film steht auf Startseite und Angebotsseiten, stumm und erst auf Klick', async ({ page }) => {
    // Breiter Bildschirm: die im Desktop-Layout aufgenommene Fassung
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/')
    const film = page.getByTestId('landing-video')
    await expect(film).toBeVisible()
    const video = film.locator('video')
    await expect(video).toHaveAttribute('src', '/film-privat-desktop.webm')
    await expect(video).toHaveAttribute('poster', '/film-privat-desktop-poster.jpg')

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
    await expect(page.getByTestId('landing-video').locator('video')).toHaveAttribute('src', '/film-betrieb-desktop.webm')
  })
})
