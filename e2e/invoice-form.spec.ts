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

  // Wait for the vehicle to appear in the list
  await expect(page.getByText('BMW 320d')).toBeVisible()

  // Click to navigate to detail page
  await page.locator('.vehicle-card').filter({ hasText: 'BMW 320d' }).click()

  // Wait for navigation and get ID from URL
  await page.waitForURL(/\/vehicles\/.+/)
  const url = page.url()
  const match = url.match(/\/vehicles\/(.+)/)
  return match ? match[1] : ''
}

test.describe('Invoice Form', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('IF-001: validation errors show', async ({ page }) => {
    const vId = await createTestVehicle(page)
    await page.goto(`/vehicles/${vId}`)

    // Switch to Rechnungen tab
    await page.getByRole('tab', { name: 'Rechnungen' }).click()

    // Open invoice form dialog
    await page.getByRole('button', { name: /rechnung.*hinzufügen/i }).click()

    // Try to submit without filling required fields
    const dialog = page.locator('[data-pc-name="dialog"]')
    await dialog.getByRole('button', { name: 'Speichern' }).click()

    // Should show validation errors
    await expect(dialog.getByText(/datum.*erforderlich/i)).toBeVisible()
  })

  test('IF-002: submit creates invoice', async ({ page }) => {
    const vId = await createTestVehicle(page)
    await page.goto(`/vehicles/${vId}`)

    // Switch to Rechnungen tab
    await page.getByRole('tab', { name: 'Rechnungen' }).click()

    // Open invoice form dialog
    await page.getByRole('button', { name: /rechnung.*hinzufügen/i }).click()

    // Fill form
    const dialog = page.locator('[data-pc-name="dialog"]')
    await dialog.locator('#invoice-date').fill('2026-02-08')
    await dialog.locator('#invoice-amount input').fill('150')

    // Select category (PrimeVue Select dropdown)
    await dialog.locator('#invoice-category').click()
    await page.getByText('Oelwechsel').click()

    // Submit
    await dialog.getByRole('button', { name: 'Speichern' }).click()

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    // Invoice should appear in list
    await expect(page.getByText(/150.*EUR/)).toBeVisible()
  })
})
