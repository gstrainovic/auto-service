import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

test.describe('Delete Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('DF-001: delete a vehicle with confirmation dialog', async ({ page }) => {
    // CREATE
    await page.goto('/vehicles')
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    await page.getByLabel('Marke').fill('VW')
    await page.getByLabel('Modell').fill('Golf')
    await page.getByLabel('Baujahr').fill('2018')
    await page.getByLabel('Kilometerstand').fill('80000')
    await page.getByLabel('Kennzeichen').fill('HH-VW 1234')
    await page.getByRole('button', { name: 'Speichern' }).click()

    // READ
    await expect(page.getByText('VW Golf')).toBeVisible()

    // Navigate to vehicle detail
    await page.getByText('VW Golf').click()
    await expect(page.getByText('HH-VW 1234')).toBeVisible()

    // DELETE with confirmation (tests AND cleans up)
    await page.locator('button:has-text("Löschen")').first().click()
    await expect(page.getByText('Fahrzeug löschen?')).toBeVisible()
    await expect(page.getByText('Alle Rechnungen und Wartungseinträge')).toBeVisible()

    await page.locator('[data-pc-name="dialog"]').getByRole('button', { name: 'Löschen' }).click()
    await expect(page).toHaveURL(/\/vehicles/)
    await expect(page.getByText('VW Golf')).not.toBeVisible({ timeout: 5_000 })
  })
})
