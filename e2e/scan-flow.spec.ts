import { expect, test } from '@playwright/test'
import { clearInstantDB } from './fixtures/db-cleanup'

test.describe('Scan Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('SF-001: scan page shows vehicle selector and upload', async ({ page }) => {
    // First add a vehicle
    await page.goto('/vehicles')
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    await page.getByLabel('Marke').fill('BMW')
    await page.getByLabel('Modell').fill('320d')
    await page.getByLabel('Baujahr').fill('2020')
    await page.getByLabel('Kilometerstand').fill('45000')
    await page.getByRole('button', { name: 'Speichern' }).click()

    // Navigate to scan
    await page.goto('/scan')
    await expect(page.getByRole('heading', { name: 'Dokument scannen' })).toBeVisible()
    // Two "Kamera" buttons exist (main action + toggle), use first()
    await expect(page.getByRole('button', { name: 'Kamera' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Datei' })).toBeVisible()
  })
})
