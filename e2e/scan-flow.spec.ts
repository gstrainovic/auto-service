import { expect, test } from '@playwright/test'

test.describe('Scan Flow', () => {
  test('scan page shows vehicle selector and upload', async ({ page }) => {
    // First add a vehicle
    await page.goto('/vehicles')
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    await page.getByLabel('Marke').fill('BMW')
    await page.getByLabel('Modell').fill('320d')
    await page.getByLabel('Baujahr').fill('2020')
    await page.getByLabel('Kilometerstand').fill('45000')
    await page.getByRole('button', { name: 'Fahrzeug speichern' }).click()

    // Navigate to scan
    await page.goto('/scan')
    await expect(page.getByRole('heading', { name: 'Rechnung scannen' })).toBeVisible()
    await expect(page.getByText('Kamera')).toBeVisible()
    await expect(page.getByText('Datei')).toBeVisible()
  })
})
