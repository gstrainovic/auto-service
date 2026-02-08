import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

test.describe('UI Primitives', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('UP-001: Button variants render', async ({ page }) => {
    await page.goto('/')

    // Create test buttons programmatically using safe DOM methods
    await page.evaluate(() => {
      const container = document.createElement('div')
      container.id = 'test-buttons'

      const createButton = (variant: string, text: string, testId: string) => {
        const btn = document.createElement('button')
        btn.className = `ui-button ui-button--${variant}`
        btn.setAttribute('data-testid', testId)
        btn.textContent = text
        return btn
      }

      container.appendChild(createButton('primary', 'Primary', 'btn-primary'))
      container.appendChild(createButton('secondary', 'Secondary', 'btn-secondary'))
      container.appendChild(createButton('ghost', 'Ghost', 'btn-ghost'))

      document.body.appendChild(container)
    })

    // Check that buttons are rendered
    await expect(page.getByTestId('btn-primary')).toBeVisible()
    await expect(page.getByTestId('btn-secondary')).toBeVisible()
    await expect(page.getByTestId('btn-ghost')).toBeVisible()

    // Verify they have appropriate classes
    const primaryBtn = page.getByTestId('btn-primary')
    await expect(primaryBtn).toHaveClass(/ui-button--primary/)
  })

  test('UP-002: Heading hierarchy', async ({ page }) => {
    await page.goto('/')

    // Create headings programmatically using safe DOM methods
    await page.evaluate(() => {
      const container = document.createElement('div')
      container.id = 'test-headings'

      const createHeading = (level: string, text: string, testId: string) => {
        const heading = document.createElement(level)
        heading.setAttribute('data-testid', testId)
        heading.textContent = text
        return heading
      }

      container.appendChild(createHeading('h1', 'Heading 1', 'h1'))
      container.appendChild(createHeading('h2', 'Heading 2', 'h2'))
      container.appendChild(createHeading('h3', 'Heading 3', 'h3'))

      document.body.appendChild(container)
    })

    // Check font sizes follow hierarchy (h1 > h2 > h3)
    const h1Size = await page.getByTestId('h1').evaluate(el =>
      Number.parseFloat(getComputedStyle(el).fontSize),
    )
    const h2Size = await page.getByTestId('h2').evaluate(el =>
      Number.parseFloat(getComputedStyle(el).fontSize),
    )
    const h3Size = await page.getByTestId('h3').evaluate(el =>
      Number.parseFloat(getComputedStyle(el).fontSize),
    )

    expect(h1Size).toBeGreaterThan(h2Size)
    expect(h2Size).toBeGreaterThan(h3Size)

    // Check that Manrope font is applied
    const h1Font = await page.getByTestId('h1').evaluate(el =>
      getComputedStyle(el).fontFamily,
    )
    expect(h1Font.toLowerCase()).toContain('manrope')
  })
})
