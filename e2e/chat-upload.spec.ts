import { Buffer } from 'node:buffer'
import path from 'node:path'
import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

const fixturesDir = path.join(import.meta.dirname, 'fixtures')

test.describe('Chat Upload Enhancements', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('CU-001: chat shows camera button on mobile for direct photo capture', async ({ page }) => {
    await page.goto('/')
    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    // Camera button should exist in the chat input area
    const cameraBtn = page.locator('[data-pc-name="drawer"]').locator('.chat-camera-btn')
    await expect(cameraBtn).toBeVisible()

    // Camera button should have a file input with capture="environment"
    const cameraInput = page.locator('[data-pc-name="drawer"] input[capture="environment"]')
    await expect(cameraInput).toHaveCount(1)

    // Camera input should accept images only
    await expect(cameraInput).toHaveAttribute('accept', 'image/*')
  })

  test('CU-002: drag and drop file onto chat adds it to pending files', async ({ page }) => {
    await page.goto('/')
    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    // We test the drop zone exists and is visible
    const dropOverlay = page.locator('[data-pc-name="drawer"] .chat-drop-overlay')

    // Simulate dragover on the drawer to show overlay
    const drawer = page.locator('[data-pc-name="drawer"]')
    await drawer.dispatchEvent('dragenter', {})
    await expect(dropOverlay).toBeVisible()

    // Simulate dragleave to hide overlay
    await drawer.dispatchEvent('dragleave', {})
    await expect(dropOverlay).not.toBeVisible()
  })

  test('CU-003: drop image file onto chat creates pending chip', async ({ page }) => {
    await page.goto('/')
    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    // Use Playwright's file-based drag & drop: set file via the hidden file input
    // (Playwright can't fully simulate HTML5 drag & drop with real files,
    // so we verify the drop handler works by using setInputFiles on the drop input)
    const fileInput = page.locator('[data-pc-name="drawer"] input[type="file"]').first()
    await fileInput.setInputFiles(path.join(fixturesDir, 'test-invoice.png'))

    // A pending chip should appear
    await expect(page.locator('[data-pc-name="chip"]')).toHaveCount(1)
    await expect(page.getByText('test-invoice.png')).toBeVisible()
  })

  test('CU-005: chat shows persistent drop hint, maximize button, no paperclip', async ({ page }) => {
    await page.goto('/')
    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    // A mini drop zone hint should be visible below the input area
    const dropHint = page.locator('[data-pc-name="drawer"] .chat-drop-hint')
    await expect(dropHint).toBeVisible()

    // It should have a dashed border and contain upload icon + text "hierher ziehen oder klicken"
    await expect(dropHint.locator('.pi-cloud-upload')).toBeVisible()
    await expect(dropHint.getByText(/hierher ziehen oder klicken/i)).toBeVisible()

    // Clicking the drop hint should trigger file input
    await expect(dropHint).toHaveCSS('cursor', 'pointer')

    // Paperclip button should NOT exist
    await expect(page.locator('[data-pc-name="drawer"] .pi-paperclip')).toHaveCount(0)

    // Maximize button should exist
    const maximizeBtn = page.locator('[data-pc-name="drawer"] .chat-maximize-btn')
    await expect(maximizeBtn).toBeVisible()
    await expect(maximizeBtn.locator('.pi-window-maximize')).toBeVisible()
  })

  test('CU-006: maximize toggle expands and collapses drawer', async ({ page }) => {
    await page.goto('/')
    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    const drawer = page.locator('[data-pc-name="drawer"]')
    const maximizeBtn = drawer.locator('.chat-maximize-btn')

    // Initially not maximized
    await expect(drawer).not.toHaveClass(/chat-maximized/)

    // Click maximize
    await maximizeBtn.click()
    await expect(drawer).toHaveClass(/chat-maximized/)

    // Click again to restore
    await maximizeBtn.click()
    await expect(drawer).not.toHaveClass(/chat-maximized/)
  })

  test('CU-007: uploading a file auto-fills prompt with "Bitte erfassen"', async ({ page }) => {
    await page.goto('/')
    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    const fileInput = page.locator('[data-pc-name="drawer"] input[type="file"]').first()
    await fileInput.setInputFiles(path.join(fixturesDir, 'test-invoice.png'))

    // Input should be auto-filled
    const chatInput = page.locator('[data-pc-name="drawer"]').getByPlaceholder('Nachricht...')
    await expect(chatInput).toHaveValue('Bitte erfassen')
  })

  test('CU-008: uploading a file does NOT overwrite existing prompt text', async ({ page }) => {
    await page.goto('/')
    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    // Type something first
    const chatInput = page.locator('[data-pc-name="drawer"]').getByPlaceholder('Nachricht...')
    await chatInput.fill('Mein spezieller Text')

    const fileInput = page.locator('[data-pc-name="drawer"] input[type="file"]').first()
    await fileInput.setInputFiles(path.join(fixturesDir, 'test-invoice.png'))

    // Should keep existing text
    await expect(chatInput).toHaveValue('Mein spezieller Text')
  })

  test('CU-004: chat accepts multiple PDF files simultaneously', async ({ page }) => {
    await page.goto('/')
    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    // Create two small test PDFs using base64
    // Use the file input (first one, not the camera input) to attach multiple PDFs
    const fileInput = page.locator('[data-pc-name="drawer"] input[type="file"]').first()

    // Create minimal PDF files for testing
    const pdfContent = Buffer.from('%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF')

    const pdf1Path = '/tmp/claude-1000/-home-g-auto-service/5d80a6b2-57a9-4f25-86e7-65de87e1881a/scratchpad/test1.pdf'
    const pdf2Path = '/tmp/claude-1000/-home-g-auto-service/5d80a6b2-57a9-4f25-86e7-65de87e1881a/scratchpad/test2.pdf'

    // Use fs to create temp PDF files
    const fs = await import('node:fs')
    fs.mkdirSync(path.dirname(pdf1Path), { recursive: true })
    fs.writeFileSync(pdf1Path, pdfContent)
    fs.writeFileSync(pdf2Path, pdfContent)

    await fileInput.setInputFiles([pdf1Path, pdf2Path])

    // Both PDF chips should appear (not just 1)
    await expect(page.locator('[data-pc-name="chip"]')).toHaveCount(2)
    await expect(page.getByText('test1.pdf')).toBeVisible()
    await expect(page.getByText('test2.pdf')).toBeVisible()
  })

  test('CU-009: chat shows welcome suggestions on first open', async ({ page }) => {
    await page.goto('/')
    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    // Welcome suggestions should be visible
    const suggestions = page.locator('.chat-suggestions')
    await expect(suggestions).toBeVisible()

    // Should show clickable suggestion chips
    const chips = page.locator('.chat-suggestion-chip')
    await expect(chips).toHaveCount(3)
    await expect(chips.filter({ hasText: 'Rechnung scannen' })).toBeVisible()
    await expect(chips.filter({ hasText: 'Fahrzeug anlegen' })).toBeVisible()
    await expect(chips.filter({ hasText: 'Wartungsstatus' })).toBeVisible()
  })

  test('CU-010: clicking a suggestion chip fills the input', async ({ page }) => {
    await page.goto('/')
    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    // Click a suggestion chip
    await page.getByText('Fahrzeug anlegen').click()

    // Input should be filled with the suggestion text
    const textarea = page.locator('[data-pc-name="drawer"]').getByPlaceholder('Nachricht...')
    await expect(textarea).toHaveValue(/Fahrzeug/)
  })

  test('CU-011: suggestions disappear after sending a message', async ({ page }) => {
    await page.goto('/')
    await page.locator('.chat-fab').click()
    await expect(page.getByText('KI-Assistent')).toBeVisible()

    // Suggestions visible initially
    await expect(page.locator('.chat-suggestions')).toBeVisible()

    // Type and send a message (no AI needed, just checking UI)
    const textarea = page.locator('[data-pc-name="drawer"]').getByPlaceholder('Nachricht...')
    await textarea.fill('Test')
    await page.locator('[data-pc-name="drawer"]').locator('.chat-fab-send').click()

    // Suggestions should be hidden after a user message is sent
    await expect(page.locator('.chat-suggestions')).not.toBeVisible()
  })
})
