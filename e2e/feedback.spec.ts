import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

// Rückmeldung aus der App (FeedbackDialog.vue): Sprachnachricht, Textfeld und Adresse zum Kopieren.
// Der lokale Proxy läuft ohne RESEND_TOKEN, die Rückmeldung wird dort nur protokolliert.

test.describe('Fehler melden oder Wunsch', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  async function oeffnen(page: any) {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Menu' }).click()
    await page.getByTestId('open-feedback').click()
    return page.getByTestId('feedback-dialog')
  }

  test('FB-001: Text schreiben und senden', async ({ page }) => {
    const dialog = await oeffnen(page)
    await expect(dialog).toBeVisible()

    // Ohne Inhalt lässt sich nichts senden
    await expect(dialog.getByTestId('feedback-send')).toBeDisabled()

    await dialog.getByTestId('feedback-text').fill('Beim Scan wird das Datum falsch erkannt.')
    await dialog.getByTestId('feedback-send').click()

    await expect(page.getByText('Danke, ist angekommen')).toBeVisible()
    await expect(dialog).not.toBeVisible()
  })

  test('FB-002: die Adresse lässt sich kopieren, auch ohne Mailprogramm', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const dialog = await oeffnen(page)
    await dialog.getByTestId('feedback-copy').click()
    await expect(page.getByText('Adresse kopiert')).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('info@wartungsheft.ch')
  })

  test('FB-003: eine Aufnahme wird transkribiert und mitgeschickt', async ({ page }) => {
    // Der Proxy ruft Mistral; im Test antwortet die Route mit einem festen Transkript
    await page.route('**/localhost:8787/feedback', async (route) => {
      const post = route.request().postData() ?? ''
      expect(post).toContain('nachricht.')
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, transcript: 'Das Datum stimmt nicht.' }) })
    })

    const dialog = await oeffnen(page)
    // Aufnahme simulieren: Playwright liefert einen Fake-Stream, MediaRecorder schreibt daraus einen Blob
    await dialog.getByTestId('feedback-record').click()
    await expect(dialog.getByTestId('feedback-stop')).toBeVisible()
    await page.waitForTimeout(1200)
    await dialog.getByTestId('feedback-stop').click()
    await expect(dialog.locator('audio')).toBeVisible()

    await dialog.getByTestId('feedback-send').click()
    await expect(page.getByText('Danke, ist angekommen')).toBeVisible()
  })
})
