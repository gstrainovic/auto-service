import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

test.describe('Design System', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('DS-001: design tokens loaded', async ({ page }) => {
    await page.goto('/')

    // Check that CSS custom properties are defined
    const bodyBg = await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue('--surface-ground'),
    )
    expect(bodyBg).toBeTruthy()

    const successColor = await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue('--status-success'),
    )
    expect(successColor).toBeTruthy()
  })

  test('DS-002: Manrope font loaded', async ({ page }) => {
    await page.goto('/')

    // Create a heading to test font
    await page.evaluate(() => {
      const h1 = document.createElement('h1')
      h1.textContent = 'Test Heading'
      h1.style.cssText = 'font-family: var(--font-heading); position: absolute; top: 0; left: 0;'
      document.body.appendChild(h1)
    })

    // Wait a bit for fonts to load
    await page.waitForTimeout(1000)

    const h1Font = await page.evaluate(() => {
      const h1 = document.querySelector('h1')
      return h1 ? getComputedStyle(h1).fontFamily : ''
    })

    // Manrope should be in the font stack
    expect(h1Font.toLowerCase()).toContain('manrope')
  })
})
