import path from 'node:path'
import { expect, test } from '@playwright/test'
import { clearInstantDB } from './fixtures/db-cleanup'

const fixturesDir = path.join(import.meta.dirname, 'fixtures')

test.describe('Chat Image Auto-Rotation', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('CI-001: landscape image is auto-rotated to portrait in chat thumbnail', async ({ page }) => {
    await page.goto('/')

    // Open chat
    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    // Attach landscape invoice image
    const fileInput = page.locator('[data-pc-name="drawer"] input[type="file"]')
    await fileInput.setInputFiles(path.join(fixturesDir, 'test-invoice-landscape.png'))

    // Send the image (no text needed — just the attachment)
    const input = page.getByPlaceholder('Nachricht...')
    await input.fill('Bild')

    // Wait for pending chip (image processing including rotation)
    await expect(page.locator('[data-pc-name="chip"]')).toHaveCount(1, { timeout: 10_000 })

    // Before sending: check chip exists
    await page.locator('[data-pc-name="drawer"]').locator('button:has(.pi-send)').click()

    // User message should contain an image thumbnail
    const userMsg = page.locator('.chat-message').nth(1) // index 0 = welcome
    const img = userMsg.locator('img')
    await expect(img).toBeVisible({ timeout: 10_000 })

    // Verify image is portrait (height > width) after auto-rotation
    const dimensions = await img.evaluate((el: HTMLImageElement) => {
      return new Promise<{ w: number, h: number }>((resolve) => {
        if (el.naturalWidth > 0)
          resolve({ w: el.naturalWidth, h: el.naturalHeight })
        else
          el.onload = () => resolve({ w: el.naturalWidth, h: el.naturalHeight })
      })
    })

    expect(dimensions.h).toBeGreaterThan(dimensions.w)
  })
})
