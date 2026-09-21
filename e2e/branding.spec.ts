import { readFileSync } from 'node:fs'
import { expect, test } from './fixtures/test-fixtures'

const favicon = readFileSync('public/favicon.svg', 'utf8')

// Produktname ist «Wartungsheft» (Domain wartungsheft.ch); der alte Name «Auto-Service» bleibt nur als Repo-Name.
test.describe('Branding', () => {
  test('BR-001: Seitentitel, App-Kopf und Login tragen den Namen Wartungsheft', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveTitle(/Wartungsheft/)
    await expect(page.locator('.app-title')).toHaveText('Wartungsheft')

    await page.goto('/login')
    await expect(page.getByRole('heading', { level: 1, name: 'Wartungsheft' })).toBeVisible()
  })

  test('BR-003: Landing Page, App-Kopf und Login zeigen dasselbe Logo wie das Favicon', async ({ page }) => {
    for (const path of ['/', '/dashboard', '/login']) {
      await page.goto(path)
      const logo = page.getByTestId('app-logo').first()
      await expect(logo).toBeVisible()
      await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
      // Vite bettet das kleine SVG als data-URI ein; verglichen wird deshalb der Inhalt, nicht der Pfad
      const src = await logo.getAttribute('src') ?? ''
      const content = src.startsWith('data:image/svg+xml,')
        ? decodeURIComponent(src.slice('data:image/svg+xml,'.length))
        : readFileSync(`public${src}`, 'utf8')
      const normalize = (svg: string) => svg.replace(/\s+/g, '').replace(/"/g, '\'')
      expect(normalize(content)).toBe(normalize(favicon))
    }
  })

  test('BR-002: öffentliche Seiten nennen den alten Namen nicht mehr', async ({ page }) => {
    for (const path of ['/betrieb', '/privathalter', '/impressum', '/datenschutz']) {
      await page.goto(path)
      await expect(page.locator('body')).not.toContainText('Auto-Service')
      await expect(page.locator('body')).toContainText('Wartungsheft')
    }
  })
})
