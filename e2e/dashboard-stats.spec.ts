import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

async function createTestVehicle(page: any, name = 'BMW 320d') {
  await page.goto('/vehicles')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
  await page.getByLabel('Marke').fill(name.split(' ')[0])
  await page.getByLabel('Modell').fill(name.split(' ')[1] || 'X')
  await page.getByLabel('Baujahr').fill('2020')
  await page.getByLabel('Kilometerstand').fill('45000')
  await page.getByLabel('Kennzeichen').fill('M-AB 1234')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText(name)).toBeVisible()
}

test.describe('Dashboard Stats', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('DB-001: dashboard shows total cost per vehicle', async ({ page }) => {
    await createTestVehicle(page)
    // Navigate to vehicle, add invoice via form
    await page.locator('.vehicle-card').filter({ hasText: 'BMW 320d' }).click()
    await page.waitForURL(/\/vehicles\/.+/)
    await page.getByRole('tab', { name: 'Rechnungen' }).click()
    await page.getByRole('button', { name: /rechnung.*hinzufügen/i }).click()

    const dialog = page.locator('[data-pc-name="dialog"]')
    await dialog.locator('#invoice-date').fill('2026-02-08')
    await dialog.locator('#invoice-amount input').fill('350')
    await dialog.getByRole('button', { name: 'Speichern' }).click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    // Go to dashboard
    await page.goto('/')
    // Should show total cost somewhere on dashboard
    await expect(page.getByText(/350/).first()).toBeVisible()
  })

  test('DB-002: dashboard shows invoice count', async ({ page }) => {
    await createTestVehicle(page)
    // Add 2 invoices
    await page.locator('.vehicle-card').filter({ hasText: 'BMW 320d' }).click()
    await page.waitForURL(/\/vehicles\/.+/)
    await page.getByRole('tab', { name: 'Rechnungen' }).click()

    for (const amount of ['100', '200']) {
      await page.getByRole('button', { name: /rechnung.*hinzufügen/i }).click()
      const dialog = page.locator('[data-pc-name="dialog"]')
      await dialog.locator('#invoice-date').fill('2026-02-08')
      await dialog.locator('#invoice-amount input').fill(amount)
      await dialog.getByRole('button', { name: 'Speichern' }).click()
      await expect(dialog).not.toBeVisible({ timeout: 5000 })
    }

    await page.goto('/')
    // Should show invoice count
    await expect(page.getByText(/2 Rechnungen/).first()).toBeVisible()
  })
})
