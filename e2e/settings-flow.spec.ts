import { expect, test } from '@playwright/test'

test.describe('Settings Flow', () => {
  test('select AI provider and enter API key', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('KI-Provider')).toBeVisible()

    // Check provider dropdown is visible
    await expect(page.getByLabel('Provider')).toBeVisible()

    // Check API key input exists
    const apiKeyInput = page.getByLabel('API Key')
    await expect(apiKeyInput).toBeVisible()
  })
})
