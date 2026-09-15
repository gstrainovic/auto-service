import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

test.describe('Dashboard Progress', () => {
  // Der Test öffnet «Letzte Wartungen nachtragen» selbst, die Fixture darf den Dialog nicht wegklicken
  test.use({ keepLastServicesDialog: true })

  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('DP-001: shows progress indicator with due count', async ({ page }) => {
    // CREATE vehicle
    await page.goto('/vehicles')
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    const dialog = page.locator('[data-pc-name="dialog"]')
    await dialog.getByLabel('Marke').fill('BMW')
    await dialog.getByLabel('Modell').fill('320d')
    await dialog.getByRole('button', { name: 'Speichern' }).click()
    await page.getByTestId('last-services-dialog').getByRole('button', { name: 'Später' }).click()

    // READ - Dashboard zeigt Progress (dueMap wird async berechnet)
    await page.goto('/')
    await expect(page.locator('.vehicle-progress')).toBeVisible({ timeout: 10_000 })
    // Ohne Einträge ist nichts fällig: neutraler Hinweis statt «OK», Intervalle ohne Eintrag zugeklappt
    await expect(page.locator('.vehicle-progress')).toHaveText('Noch keine Wartung erfasst')
    await expect(page.locator('.maintenance-item', { hasText: 'Kein Eintrag' })).toHaveCount(0)
    await expect(page.getByText('Überfällig', { exact: true })).toHaveCount(0)

    // Nach einem nachgetragenen Ölwechsel zählt der Fortschritt: 0 von 9 fällig, 8 Arbeiten ohne Eintrag zugeklappt
    await page.locator('.vehicle-section').getByRole('button', { name: 'Letzte Wartungen nachtragen' }).click()
    const last = page.getByTestId('last-services-dialog')
    await last.locator('#last-oelwechsel-date').fill(new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10))
    await last.getByRole('button', { name: '1 Eintrag speichern' }).click()
    await expect(page.getByText('0/9 fällig')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: '8 Arbeiten ohne Eintrag anzeigen' })).toBeVisible()

    // DELETE
    await page.goto('/vehicles')
    await page.getByText('BMW 320d').click()
    await page.locator('button:has-text("Löschen")').first().click()
    await page.locator('[data-pc-name="dialog"]').getByRole('button', { name: 'Löschen' }).click()
  })
})
