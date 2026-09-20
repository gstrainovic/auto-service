import { expect, test } from './fixtures/test-fixtures'

test.describe('Public Pages', () => {
  test('PP-001: impressum shows contact info and Swiss law reference', async ({ page }) => {
    await page.goto('/impressum')
    await expect(page.getByRole('heading', { name: 'Impressum' })).toBeVisible()
    await expect(page.getByText('Goran Strainovic').first()).toBeVisible()
    await expect(page.getByText('Strainovic IT').first()).toBeVisible()
    // Vollständige Adresse (UWG Art. 3 Abs. 1 lit. s)
    await expect(page.getByRole('main')).toContainText('Bahnstrasse 9b')
    await expect(page.getByText('9323 Steinach')).toBeVisible()
    await expect(page.getByText('UWG')).toBeVisible()
    // Kopf: Logo führt zur Startseite; Fuss: Rechtliches und Kontakt
    await expect(page.getByRole('banner').getByRole('link', { name: 'Wartungsheft' })).toHaveAttribute('href', '/')
    await expect(page.getByRole('link', { name: 'Datenschutz' })).toBeVisible()
    await expect(page.getByRole('contentinfo').getByRole('link', { name: 'info@wartungsheft.ch' })).toBeVisible()
  })

  test('PP-002: datenschutz shows privacy policy with nDSG sections', async ({ page }) => {
    await page.goto('/datenschutz')
    await expect(page.getByRole('heading', { name: 'Datenschutzerklärung' })).toBeVisible()
    await expect(page.getByText('Goran Strainovic').first()).toBeVisible()
    // Key sections present
    await expect(page.getByRole('heading', { name: /Verantwortliche Stelle/ })).toBeVisible()
    await expect(page.getByRole('main')).toContainText('Bahnstrasse 9b')
    await expect(page.getByRole('heading', { name: /KI-gestützte Verarbeitung/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Ihre Rechte/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Cookies/ })).toBeVisible()
    // AI provider table: Mistral only
    // Mistral steht in Abschnitt 5 (KI) und Abschnitt 7 (Weitergabe)
    await expect(page.getByRole('cell', { name: 'Mistral AI' })).toHaveCount(2)
    await expect(page.getByText(/Anthropic|OpenAI|OpenRouter|Ollama/)).toHaveCount(0)
    // EDÖB reference
    await expect(page.getByText('EDÖB')).toBeVisible()
    // Footer-Links
    await expect(page.getByRole('link', { name: 'Impressum' })).toBeVisible()
  })

  test('PP-003: navigation between public pages works', async ({ page }) => {
    await page.goto('/impressum')
    await page.getByRole('link', { name: 'Datenschutz' }).click()
    await expect(page).toHaveURL(/\/datenschutz/)
    await expect(page.getByRole('heading', { name: 'Datenschutzerklärung' })).toBeVisible()

    await page.getByRole('link', { name: 'Impressum' }).click()
    await expect(page).toHaveURL(/\/impressum/)
    await expect(page.getByRole('heading', { name: 'Impressum' })).toBeVisible()
  })

  test('PP-005: AGB nennen Anbieter, Testzeit, Preise, Verlängerung und Kündigung', async ({ page }) => {
    await page.goto('/impressum')
    await page.getByRole('contentinfo').getByRole('link', { name: 'AGB' }).click()
    await expect(page).toHaveURL(/\/agb$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Allgemeine Geschäftsbedingungen')
    const main = page.getByRole('main')
    await expect(main).toContainText('Goran Strainovic')
    await expect(main).toContainText('Bahnstrasse 9b, 9323 Steinach')
    for (const heading of [/Testzeit/, /Preise/, /Rechnung und Zahlung/, /Laufzeit, Verlängerung und Kündigung/, /Haftung/, /Deine Daten/, /Anwendbares Recht/])
      await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    await expect(main).toContainText('verlängert sich automatisch um ein weiteres Jahr')
    await expect(main).toContainText('bis zum letzten Tag der Laufzeit ohne Frist')
    await expect(main).toContainText('CHF 36.00 pro Fahrzeug und Jahr')
    await expect(main).toContainText('CHF 25.00 im Jahr')
    await expect(page.getByRole('link', { name: 'Datenschutzerklärung' })).toHaveAttribute('href', '/datenschutz')

    // Handy: das lange Wort im Titel darf die Seite nicht verbreitern
    await page.setViewportSize({ width: 390, height: 844 })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('PP-006: Hilfe erklärt die Kernabläufe und beantwortet häufige Fragen', async ({ page }) => {
    await page.goto('/impressum')
    await page.getByRole('contentinfo').getByRole('link', { name: 'Hilfe' }).click()
    await expect(page).toHaveURL(/\/hilfe$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Hilfe')

    // Ein Abschnitt je Kernablauf (CLAUDE.md «Abläufe prüfen, nicht nur Seiten»)
    for (const heading of [/Fahrzeug erfassen/, /Rechnung erfassen/, /Wartung ohne Rechnung/, /Serviceheft und Intervalle/, /Kosten exportieren/, /Erinnerung bekommen/, /verkaufen oder abgeben/, /Kilometerstand/, /Fuhrpark/])
      await expect(page.getByRole('heading', { name: heading })).toBeVisible()

    // Häufige Fragen als FAQPage, damit Suchmaschinen und KI-Antworten den Text übernehmen
    const faq = await page.locator('script[type="application/ld+json"]').allTextContents()
    const typen = faq.map(t => JSON.parse(t)['@type'])
    expect(typen).toContain('FAQPage')

    // Handy: kein waagrechtes Scrollen
    await page.setViewportSize({ width: 390, height: 844 })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('PP-007: Startseite trägt die Beschreibung für Suchmaschinen und KI-Antworten', async ({ page }) => {
    await page.goto('/')
    // Ein Satz, der die Frage «Was ist wartungsheft.ch?» beantwortet, sichtbar und als Metadaten
    await expect(page.getByRole('main').first()).toContainText(/Serviceheft/)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Serviceheft/)
    const daten = await page.locator('script[type="application/ld+json"]').allTextContents()
    const typen = daten.map(t => JSON.parse(t)['@type'])
    expect(typen).toContain('SoftwareApplication')
  })

  test('PP-008: robots.txt und sitemap.xml führen die öffentlichen Seiten', async ({ page }) => {
    const robots = await page.request.get('/robots.txt')
    expect(robots.status()).toBe(200)
    const text = await robots.text()
    // KI-Crawler ausdrücklich erlaubt, sonst fehlt die Seite in den Antworten
    for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'])
      expect(text).toContain(bot)
    expect(text).toContain('Sitemap:')

    const sitemap = await page.request.get('/sitemap.xml')
    expect(sitemap.status()).toBe(200)
    const xml = await sitemap.text()
    for (const pfad of ['/betrieb', '/privathalter', '/hilfe', '/agb'])
      expect(xml).toContain(`https://wartungsheft.ch${pfad}`)

    const llms = await page.request.get('/llms.txt')
    expect(llms.status()).toBe(200)
    expect(await llms.text()).toContain('wartungsheft.ch')
  })

  test('PP-004: logged-in user is redirected from / to /dashboard', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/dashboard/)
    // App-Layout sichtbar (Menu-Button + Chat-FAB = Dashboard, nicht Landing Page)
    await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible()
    await expect(page.locator('.chat-fab')).toBeVisible()
  })
})
