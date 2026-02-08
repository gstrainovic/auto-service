import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

test.describe('Scan Redirect Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('SR-001: /scan redirects to chat and opens maximized', async ({ page }) => {
    await page.goto('/scan')
    // Sollte auf / redirecten mit chat=open
    await expect(page).toHaveURL(/\/\?chat=open/)
    // Chat-Drawer sollte offen und maximiert sein
    const drawer = page.locator('[data-pc-name="drawer"]')
    await expect(drawer).toBeVisible()
    await expect(drawer).toHaveClass(/chat-maximized/)
  })

  test('SR-002: navigation shows KI-Assistent instead of Dokument scannen', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Menu' }).click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()
    await expect(page.getByText('Dokument scannen')).not.toBeVisible()
  })
})
