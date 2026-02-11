import { expect, test } from './fixtures/test-fixtures'

test.describe('Public Pages', () => {
  test('PP-001: impressum shows contact info and Swiss law reference', async ({ page }) => {
    await page.goto('/impressum')
    await expect(page.getByRole('heading', { name: 'Impressum' })).toBeVisible()
    await expect(page.getByText('Goran Strainovic').first()).toBeVisible()
    await expect(page.getByText('Strainovic IT').first()).toBeVisible()
    await expect(page.getByText('9323 Steinach')).toBeVisible()
    await expect(page.getByText('UWG')).toBeVisible()
    // Footer-Links
    await expect(page.getByRole('link', { name: 'Startseite' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Datenschutz' })).toBeVisible()
  })

  test('PP-002: datenschutz shows privacy policy with nDSG sections', async ({ page }) => {
    await page.goto('/datenschutz')
    await expect(page.getByRole('heading', { name: 'Datenschutzerklärung' })).toBeVisible()
    await expect(page.getByText('Goran Strainovic').first()).toBeVisible()
    // Key sections present
    await expect(page.getByRole('heading', { name: /Verantwortliche Stelle/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /KI-gestützte Verarbeitung/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Ihre Rechte/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Cookies/ })).toBeVisible()
    // AI provider table
    await expect(page.getByText('Mistral AI')).toBeVisible()
    await expect(page.getByText('Ollama (lokal)')).toBeVisible()
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

  test('PP-004: logged-in user is redirected from / to /dashboard', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/dashboard/)
    // App-Layout sichtbar (Menu-Button + Chat-FAB = Dashboard, nicht Landing Page)
    await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible()
    await expect(page.locator('.chat-fab')).toBeVisible()
  })
})
