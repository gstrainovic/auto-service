import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

// Anstoss vor Ende der Testzeit (src/services/trial-reminder.ts): in der letzten Woche steht auf dem Dashboard ein
// Hinweis mit Weg zur Bestellung. Die Testzeit kommt aus der Entität `subscriptions`, die der AI-Proxy führt.

/** Testzeit zurückdatieren; der Proxy führt sie selbst (`/test/trial` gibt es nur im lokalen Bypass) */
async function seedTrial(page: any, daysUsed: number): Promise<void> {
  const res = await page.request.put('http://localhost:8787/test/trial', {
    headers: { 'x-user-id': 'e2e-test-user' },
    data: { daysUsed },
  })
  expect(res.ok()).toBe(true)
}

test.describe('Hinweis vor Ende der Testzeit', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('TN-001: in der letzten Woche steht der Hinweis mit Restzeit und führt zur Bestellung', async ({ page }) => {
    await seedTrial(page, 25)
    await page.goto('/dashboard')
    const hint = page.getByTestId('trial-hint')
    await expect(hint).toContainText('Testzeit läuft noch 5 Tage')
    await hint.getByRole('button', { name: 'Jahresabo bestellen' }).click()
    await expect(page).toHaveURL(/\/settings/)
  })

  test('TN-002: früher in der Testzeit bleibt das Dashboard still', async ({ page }) => {
    await seedTrial(page, 3)
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'Übersicht' })).toBeVisible()
    await expect(page.getByTestId('trial-hint')).toHaveCount(0)
  })

  test('TN-003: ohne Kaufweg im Proxy weder Hinweis noch Bestellknopf', async ({ page }) => {
    await seedTrial(page, 25)
    // Der lokale Proxy nimmt Bestellungen an (Rechnung von Hand an INVOICE_EMAIL); ohne IBAN und Postfach meldet er `ordering: false`
    await page.route('**/me/usage', async (route) => {
      const res = await route.fetch()
      const body = await res.json()
      await route.fulfill({ json: { ...body, ordering: false } })
    })
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'Übersicht' })).toBeVisible()
    await expect(page.getByTestId('trial-hint')).toHaveCount(0)

    await page.goto('/settings')
    const card = page.locator('.settings-card', { hasText: 'Abo & Nutzung' })
    await expect(card).toContainText('Testzeit')
    await expect(card.getByRole('button', { name: 'Jahresabo bestellen' })).toHaveCount(0)
  })
})
