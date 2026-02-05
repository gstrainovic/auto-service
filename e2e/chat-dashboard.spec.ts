import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

test.describe('Chat on Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('CF-005: chat works on dashboard without vehicle context', async ({ page }) => {
    // Go to dashboard (not vehicle detail)
    await page.goto('/')

    // Chat FAB should be visible on dashboard
    await expect(page.locator('.chat-fab')).toBeVisible()

    // Open chat
    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    // Send message asking about vehicles
    await page.getByPlaceholder('Nachricht...').fill('Welche Fahrzeuge habe ich?')
    await page.locator('.chat-fab-send').click()

    // Should get response (list_vehicles tool works without vehicleId)
    await expect(page.locator('.bubble-assistant').last()).toContainText(
      /fahrzeug|keine|erledigt/i,
      { timeout: 30_000 },
    )
  })
})
