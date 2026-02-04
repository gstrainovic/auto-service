import { expect, test } from '@playwright/test'
import { clearInstantDB } from './fixtures/db-cleanup'

test.describe('Vehicle Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('VF-001: add a vehicle and see it in the list', async ({ page }) => {
    await page.goto('/vehicles')
    await expect(page.getByText('Noch keine Fahrzeuge')).toBeVisible()

    await page.getByRole('button', { name: 'Hinzufügen' }).click()

    // Quasar outlined inputs render label as aria-label
    await page.getByLabel('Marke').fill('BMW')
    await page.getByLabel('Modell').fill('320d')
    await page.getByLabel('Baujahr').fill('2020')
    await page.getByLabel('Kilometerstand').fill('45000')
    await page.getByLabel('Kennzeichen').fill('M-AB 1234')
    await page.getByRole('button', { name: 'Speichern' }).click()

    await expect(page.getByText('BMW 320d')).toBeVisible()
    await expect(page.getByText('45.000 km')).toBeVisible()
  })

  test('VF-002: vehicle appears on dashboard after adding', async ({ page }) => {
    await page.goto('/vehicles')
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    await page.getByLabel('Marke').fill('VW')
    await page.getByLabel('Modell').fill('Golf')
    await page.getByLabel('Baujahr').fill('2019')
    await page.getByLabel('Kilometerstand').fill('80000')
    await page.getByRole('button', { name: 'Speichern' }).click()

    await expect(page.getByText('VW Golf')).toBeVisible()

    await page.goto('/')
    await expect(page.getByText('VW Golf')).toBeVisible()
  })

  test('VF-003: delete a vehicle', async ({ page }) => {
    await page.goto('/vehicles')
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    await page.getByLabel('Marke').fill('Audi')
    await page.getByLabel('Modell').fill('A4')
    await page.getByLabel('Baujahr').fill('2021')
    await page.getByLabel('Kilometerstand').fill('30000')
    await page.getByRole('button', { name: 'Speichern' }).click()

    await expect(page.getByText('Audi A4')).toBeVisible()

    // Delete button: PrimeVue icon-only button within the Audi A4 vehicle card
    const audiCard = page.locator('[data-pc-name="card"]', { hasText: 'Audi A4' })
    await audiCard.getByRole('button', { name: 'Löschen' }).click()

    await expect(page.getByText('Audi A4')).not.toBeVisible()
  })
})
