import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

test.describe('Empty States', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('ES-001: vehicles page shows CTA in empty state', async ({ page }) => {
    await page.goto('/vehicles')
    await expect(page.locator('.empty-icon')).toBeVisible()
    await expect(page.getByText('Keine Fahrzeuge')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Fahrzeug hinzufügen' })).toBeVisible()
  })

  test('ES-003: dashboard CTA opens vehicle form directly', async ({ page }) => {
    await page.goto('/')
    // Dashboard empty state should show "Fahrzeug hinzufügen" button
    await expect(page.getByRole('button', { name: 'Fahrzeug hinzufügen' })).toBeVisible()
    await page.getByRole('button', { name: 'Fahrzeug hinzufügen' }).click()

    // Should navigate to /vehicles AND open the form dialog immediately
    await expect(page).toHaveURL(/\/vehicles\?action=add/)
    await expect(page.getByText('Neues Fahrzeug')).toBeVisible({ timeout: 3_000 })

    // Dialog should be functional (can fill form)
    const dialog = page.locator('[data-pc-name="dialog"]')
    await expect(dialog.getByLabel('Marke')).toBeVisible()
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
