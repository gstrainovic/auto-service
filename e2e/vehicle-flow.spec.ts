import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

test.describe('Vehicle Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('VF-001: full CRUD cycle - add, view, update, delete vehicle', async ({ page }) => {
    // CREATE
    await page.goto('/vehicles')
    await expect(page.getByText('Keine Fahrzeuge')).toBeVisible()

    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    await page.getByLabel('Marke').fill('BMW')
    await page.getByLabel('Modell').fill('320d')
    await page.getByLabel('Baujahr').fill('2020')
    await page.getByLabel('Kilometerstand').fill('45000')
    await page.getByLabel('Kennzeichen').fill('M-AB 1234')
    await page.getByRole('button', { name: 'Speichern' }).click()

    // READ
    await expect(page.getByText('BMW 320d')).toBeVisible()
    await expect(page.getByText('45.000 km')).toBeVisible()

    // UPDATE - navigate to detail and edit
    await page.getByText('BMW 320d').click()
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    const dialog = page.locator('[data-pc-name="dialog"]')
    await dialog.getByLabel('Kilometerstand').fill('50000')
    await dialog.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('50.000 km')).toBeVisible()

    // DELETE (tests AND cleans up)
    await page.locator('button:has-text("Löschen")').first().click()
    await expect(page.getByText('Fahrzeug löschen?')).toBeVisible()
    await page.locator('[data-pc-name="dialog"]').getByRole('button', { name: 'Löschen' }).click()
    await expect(page).toHaveURL(/\/vehicles/)
    await expect(page.getByText('BMW 320d')).not.toBeVisible({ timeout: 5_000 })
  })

  test('VF-002: vehicle appears on dashboard after adding', async ({ page }) => {
    // CREATE
    await page.goto('/vehicles')
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    await page.getByLabel('Marke').fill('VW')
    await page.getByLabel('Modell').fill('Golf')
    await page.getByLabel('Baujahr').fill('2019')
    await page.getByLabel('Kilometerstand').fill('80000')
    await page.getByRole('button', { name: 'Speichern' }).click()

    // READ on vehicles page
    await expect(page.getByText('VW Golf').first()).toBeVisible()

    // READ on dashboard
    await page.goto('/')
    await expect(page.getByText('VW Golf')).toBeVisible()

    // DELETE (cleanup)
    await page.goto('/vehicles')
    await page.getByText('VW Golf').click()
    await page.locator('button:has-text("Löschen")').first().click()
    await page.locator('[data-pc-name="dialog"]').getByRole('button', { name: 'Löschen' }).click()
    await expect(page.getByText('VW Golf')).not.toBeVisible({ timeout: 5_000 })
  })

  test('VF-003: delete a vehicle from card', async ({ page }) => {
    // CREATE
    await page.goto('/vehicles')
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    await page.getByLabel('Marke').fill('Audi')
    await page.getByLabel('Modell').fill('A4')
    await page.getByLabel('Baujahr').fill('2021')
    await page.getByLabel('Kilometerstand').fill('30000')
    await page.getByRole('button', { name: 'Speichern' }).click()

    // READ
    await expect(page.getByText('Audi A4').first()).toBeVisible()

    // DELETE from card (tests AND cleans up)
    const audiCard = page.locator('[data-pc-name="card"]', { hasText: 'Audi A4' }).first()
    await audiCard.getByRole('button', { name: 'Löschen' }).click()
    await expect(page.getByText('Audi A4')).not.toBeVisible()
  })

  test('VF-004: vehicle card shows status badge and license plate', async ({ page }) => {
    // CREATE with license plate
    await page.goto('/vehicles')
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    const dialog = page.locator('[data-pc-name="dialog"]')
    await dialog.getByLabel('Marke').fill('Test')
    await dialog.getByLabel('Modell').fill('Status')
    await dialog.getByLabel('Baujahr').fill('2022')
    await dialog.getByLabel('Kennzeichen').fill('M-AB 1234')
    await dialog.getByRole('button', { name: 'Speichern' }).click()

    // READ - Status badge visible
    const card = page.locator('[data-pc-name="card"]', { hasText: 'Test Status' }).first()
    await expect(card).toBeVisible()
    await expect(card.locator('[data-pc-name="badge"]').first()).toBeVisible()

    // Kennzeichen Badge visible
    await expect(card.locator('.license-badge')).toContainText('M-AB 1234')

    // DELETE (cleanup)
    await card.getByRole('button', { name: 'Löschen' }).click()
    await expect(page.getByText('Test Status')).not.toBeVisible()
  })
})
