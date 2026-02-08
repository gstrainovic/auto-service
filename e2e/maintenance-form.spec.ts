import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

async function createTestVehicle(page: any) {
  await page.goto('/vehicles')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
  await page.getByLabel('Marke').fill('BMW')
  await page.getByLabel('Modell').fill('320d')
  await page.getByLabel('Baujahr').fill('2020')
  await page.getByLabel('Kilometerstand').fill('45000')
  await page.getByLabel('Kennzeichen').fill('M-AB 1234')
  await page.getByRole('button', { name: 'Speichern' }).click()

  await expect(page.getByText('BMW 320d')).toBeVisible()

  await page.locator('.vehicle-card').filter({ hasText: 'BMW 320d' }).click()

  await page.waitForURL(/\/vehicles\/.+/)
  const url = page.url()
  const match = url.match(/\/vehicles\/(.+)/)
  return match ? match[1] : ''
}

test.describe('Maintenance Form', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('MF-001: validation errors show', async ({ page }) => {
    const vId = await createTestVehicle(page)
    await page.goto(`/vehicles/${vId}`)

    // Wartung tab is already selected by default

    // Open maintenance form dialog
    await page.getByRole('button', { name: /wartung.*hinzufügen/i }).click()

    // Try to submit without filling required fields
    const dialog = page.locator('[data-pc-name="dialog"]')
    await dialog.getByRole('button', { name: 'Speichern' }).click()

    // Should show validation errors
    await expect(dialog.getByText(/kategorie.*erforderlich/i)).toBeVisible()
  })

  test('MF-002: submit creates maintenance', async ({ page }) => {
    const vId = await createTestVehicle(page)
    await page.goto(`/vehicles/${vId}`)

    // Wartung tab is already selected by default

    // Open maintenance form dialog
    await page.getByRole('button', { name: /wartung.*hinzufügen/i }).click()

    // Fill form
    const dialog = page.locator('[data-pc-name="dialog"]')

    // Select category (PrimeVue Select dropdown)
    await dialog.locator('#maintenance-category').click()
    await page.getByText('Inspektion').click()

    await dialog.locator('#maintenance-date').fill('2026-02-08')
    await dialog.locator('#maintenance-mileage input').fill('50000')

    // Submit
    await dialog.getByRole('button', { name: 'Speichern' }).click()

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    // Maintenance should appear
    await expect(page.getByText('Inspektion')).toBeVisible()
  })
})
