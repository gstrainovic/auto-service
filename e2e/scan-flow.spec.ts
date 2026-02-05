import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

test.describe('Scan Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('SF-001: scan page shows vehicle selector and upload', async ({ page }) => {
    // CREATE vehicle
    await page.goto('/vehicles')
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    await page.getByLabel('Marke').fill('BMW')
    await page.getByLabel('Modell').fill('320d')
    await page.getByLabel('Baujahr').fill('2020')
    await page.getByLabel('Kilometerstand').fill('45000')
    await page.getByRole('button', { name: 'Speichern' }).click()

    // READ - verify scan page elements
    await page.goto('/scan')
    await expect(page.getByRole('heading', { name: 'Dokument scannen' })).toBeVisible()
    // Two "Kamera" buttons exist (main action + toggle), use first()
    await expect(page.getByRole('button', { name: 'Kamera' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Datei' })).toBeVisible()

    // Drag & Drop zone visible
    await expect(page.locator('.drop-zone')).toBeVisible()
    await expect(page.getByText(/hierher ziehen/i)).toBeVisible()

    // DELETE (cleanup)
    await page.goto('/vehicles')
    await page.getByText('BMW 320d').click()
    await page.locator('button:has-text("Löschen")').first().click()
    await page.locator('[data-pc-name="dialog"]').getByRole('button', { name: 'Löschen' }).click()
    await expect(page.getByText('BMW 320d')).not.toBeVisible({ timeout: 5_000 })
  })
})
