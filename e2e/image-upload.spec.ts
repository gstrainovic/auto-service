import path from 'node:path'
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
}

test.describe('Image Upload', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('IU-001: invoice form shows image preview after upload', async ({ page }) => {
    await createTestVehicle(page)
    await page.locator('.vehicle-card').filter({ hasText: 'BMW 320d' }).click()
    await page.waitForURL(/\/vehicles\/.+/)
    await page.getByRole('tab', { name: 'Rechnungen' }).click()
    await page.getByRole('button', { name: /rechnung.*hinzufügen/i }).click()

    const dialog = page.locator('[data-pc-name="dialog"]')
    // Upload test image
    const fileInput = dialog.locator('input[type="file"]')
    await fileInput.setInputFiles(
      path.join(import.meta.dirname, 'fixtures', 'test-invoice.png'),
    )

    // Should show image preview
    await expect(dialog.locator('.image-preview img')).toBeVisible({ timeout: 5000 })
  })

  test('IU-002: invoice form submits with image', async ({ page }) => {
    await createTestVehicle(page)
    await page.locator('.vehicle-card').filter({ hasText: 'BMW 320d' }).click()
    await page.waitForURL(/\/vehicles\/.+/)
    await page.getByRole('tab', { name: 'Rechnungen' }).click()
    await page.getByRole('button', { name: /rechnung.*hinzufügen/i }).click()

    const dialog = page.locator('[data-pc-name="dialog"]')

    // Fill form
    await dialog.locator('#invoice-date').fill('2026-02-08')
    await dialog.locator('#invoice-amount input').fill('250')

    // Upload image
    const fileInput = dialog.locator('input[type="file"]')
    await fileInput.setInputFiles(
      path.join(import.meta.dirname, 'fixtures', 'test-invoice.png'),
    )
    await expect(dialog.locator('.image-preview img')).toBeVisible({ timeout: 5000 })

    // Submit
    await dialog.getByRole('button', { name: 'Speichern' }).click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    // Invoice should be saved with image (thumbnail visible in list)
    await expect(page.getByText(/250/).first()).toBeVisible()
  })
})
