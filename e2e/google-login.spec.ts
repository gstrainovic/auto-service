import { expect, test } from './fixtures/test-fixtures'

// Anmeldung mit Google über den Redirect-Flow von InstantDB: der Button führt zur OAuth-Start-URL des
// eigenen Backends (/runtime/oauth/start), der Rest läuft bei Google und im Backend. Magic Codes bleiben.
test.describe('Google-Login', () => {
  test('GL-001: Login-Seite bietet «Mit Google anmelden» und startet den OAuth-Flow beim Backend', async ({ page }) => {
    const started: string[] = []
    await page.route('**/runtime/oauth/start**', async (route) => {
      started.push(route.request().url())
      await route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>oauth-start</body></html>' })
    })

    await page.goto('/login')
    const button = page.getByRole('link', { name: 'Mit Google anmelden' })
    await expect(button).toBeVisible()
    await expect(button).toHaveAttribute('href', /\/runtime\/oauth\/start\?/)
    await button.click()
    await expect.poll(() => started.length).toBe(1)
    const url = new URL(started[0]!)
    expect(url.searchParams.get('client_name')).toBe('google-web')
    expect(url.searchParams.get('redirect_uri')).toMatch(/^http:\/\/localhost:6060\//)
    // Magic Code bleibt als zweiter Weg sichtbar
    await page.goto('/login')
    await expect(page.getByRole('button', { name: 'Code senden' })).toBeVisible()
  })
})
