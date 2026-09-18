import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

async function createTestVehicle(page: any) {
  await page.goto('/vehicles')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
  await page.getByLabel('Marke').fill('BMW')
  await page.getByLabel('Modell').fill('320d')
  await page.getByLabel('Baujahr').fill('2020')
  await page.getByLabel('Kilometerstand').fill('45000')
  await page.getByLabel('Kontrollschild').fill('M-AB 1234')
  await page.getByRole('button', { name: 'Speichern' }).click()

  // Nach dem Speichern führt die App direkt auf die Fahrzeugseite; ID aus der URL
  await page.waitForURL(/\/vehicles\/.+/)
  await expect(page.getByRole('heading', { name: 'BMW 320d' })).toBeVisible()
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
    await page.getByRole('option', { name: 'Ölwechsel' }).click()

    // Submit
    await dialog.getByRole('button', { name: 'Speichern' }).click()

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    // Invoice should appear in list
    // Standardwährung CHF, Schweizer Format (CHF 150.00)
    await expect(page.locator('.invoice-item').getByText(/CHF.150\.00/)).toBeVisible()
  })
})
