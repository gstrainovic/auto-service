import { expect, test } from '@playwright/test'

test.describe('Delete Flow', () => {
  test('DF-001: delete a vehicle with confirmation dialog', async ({ page }) => {
    // Add a vehicle first
    await page.goto('/vehicles')
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    await page.getByLabel('Marke').fill('VW')
    await page.getByLabel('Modell').fill('Golf')
    await page.getByLabel('Baujahr').fill('2018')
    await page.getByLabel('Kilometerstand').fill('80000')
    await page.getByLabel('Kennzeichen').fill('HH-VW 1234')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('VW Golf')).toBeVisible()

    // Navigate to vehicle detail
    await page.getByText('VW Golf').click()
    await expect(page.getByText('HH-VW 1234')).toBeVisible()

    // Click delete and confirm
    await page.getByRole('button', { name: 'Löschen' }).click()
    await expect(page.getByText('Fahrzeug löschen?')).toBeVisible()
    await expect(page.getByText('Alle Rechnungen und Wartungseinträge')).toBeVisible()

    // Confirm delete
    await page.locator('.q-dialog').getByRole('button', { name: 'Löschen' }).click()

    // Should redirect to vehicles list
    await expect(page).toHaveURL(/\/vehicles/)
    await expect(page.getByText('VW Golf')).not.toBeVisible({ timeout: 5_000 })
  })

  test('DF-002: scan page has document type tabs', async ({ page }) => {
    await page.goto('/scan')
    await expect(page.getByRole('heading', { name: 'Dokument scannen' })).toBeVisible()

    // Verify tabs exist
    await expect(page.getByRole('tab', { name: 'Rechnung' })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Kaufvertrag/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Service-Heft' })).toBeVisible()

    // Switch tabs
    await page.getByRole('tab', { name: /Kaufvertrag/ }).click()
    // Vehicle selector should NOT be visible for Kaufvertrag tab
    await expect(page.getByLabel('Fahrzeug wählen')).not.toBeVisible()

    // Switch to Service-Heft tab - vehicle selector should reappear
    await page.getByRole('tab', { name: 'Service-Heft' }).click()
    await expect(page.getByLabel('Fahrzeug wählen')).toBeVisible()
  })
})
