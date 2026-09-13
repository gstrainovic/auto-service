import { expect, test } from './fixtures/test-fixtures'

// Produktname ist «Wartungsheft» (Domain wartungsheft.ch); der alte Name «Auto-Service» bleibt nur als Repo-Name.
test.describe('Branding', () => {
  test('BR-001: Seitentitel, App-Kopf und Login tragen den Namen Wartungsheft', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveTitle(/Wartungsheft/)
    await expect(page.locator('.app-title')).toHaveText('Wartungsheft')

    await page.goto('/login')
    await expect(page.getByRole('heading', { level: 1, name: 'Wartungsheft' })).toBeVisible()
  })

  test('BR-002: öffentliche Seiten nennen den alten Namen nicht mehr', async ({ page }) => {
    for (const path of ['/betrieb', '/privathalter', '/impressum', '/datenschutz']) {
      await page.goto(path)
      await expect(page.locator('body')).not.toContainText('Auto-Service')
      await expect(page.locator('body')).toContainText('Wartungsheft')
    }
  })
})
