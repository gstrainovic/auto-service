import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

test.describe('Dashboard Progress', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('DP-001: shows progress indicator with due count', async ({ page }) => {
    // CREATE vehicle
    await page.goto('/vehicles')
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    const dialog = page.locator('[data-pc-name="dialog"]')
    await dialog.getByLabel('Marke').fill('BMW')
    await dialog.getByLabel('Modell').fill('320d')
    await dialog.getByRole('button', { name: 'Speichern' }).click()

    // READ - Dashboard zeigt Progress (dueMap wird async berechnet)
    await page.goto('/')
    await expect(page.locator('.vehicle-progress')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/\d+\/\d+ fällig/)).toBeVisible({ timeout: 10_000 })

    // DELETE
    await page.goto('/vehicles')
    await page.getByText('BMW 320d').click()
    await page.locator('button:has-text("Löschen")').first().click()
    await page.locator('[data-pc-name="dialog"]').getByRole('button', { name: 'Löschen' }).click()
  })
})
