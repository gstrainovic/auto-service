import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

test.describe('Empty States', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('ES-001: vehicles page shows CTA in empty state', async ({ page }) => {
    await page.goto('/vehicles')
    await expect(page.locator('.empty-icon')).toBeVisible()
    await expect(page.getByText('Keine Fahrzeuge')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Erstes Fahrzeug anlegen' })).toBeVisible()
  })

  test('ES-002: vehicle detail shows empty state in invoices tab', async ({ page }) => {
    // CREATE
    await page.goto('/vehicles')
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    const dialog = page.locator('[data-pc-name="dialog"]')
    await dialog.getByLabel('Marke').fill('Test')
    await dialog.getByLabel('Modell').fill('Empty')
    await dialog.getByRole('button', { name: 'Speichern' }).click()

    await page.getByText('Test Empty').click()
    await page.getByRole('tab', { name: 'Rechnungen' }).click()
    await expect(page.getByText(/keine rechnungen/i)).toBeVisible()

    // DELETE
    await page.locator('button:has-text("Löschen")').first().click()
    await page.locator('[data-pc-name="dialog"]').getByRole('button', { name: 'Löschen' }).click()
  })
})
