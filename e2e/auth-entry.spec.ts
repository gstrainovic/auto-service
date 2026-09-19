import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/test-fixtures'

// Anmelde-Einstieg: Magic Code und Google legen Konten beim ersten Mal an, eine Trennung Registrieren/Login
// braucht es technisch nicht. Die Seite merkt sich aber im Browser, dass hier schon jemand ein Konto hat
// (E-Mail im localStorage, bleibt nach dem Abmelden), und zeigt dann «Anmelden» statt der Testzeit.
// Im lokalen Modus ist man sonst immer eingeloggt; `auth:localSignedOut` spielt den abgemeldeten Zustand.

const PHONE = { width: 390, height: 844 }

async function startSignedOut(page: Page, knownEmail?: string) {
  await page.addInitScript((email) => {
    // Nur beim ersten Laden setzen, damit An- und Abmelden im Test danach wirken
    if (sessionStorage.getItem('e2e:seeded'))
      return
    sessionStorage.setItem('e2e:seeded', '1')
    localStorage.setItem('auth:localSignedOut', '1')
    if (email)
      localStorage.setItem('auth:knownEmail', email)
    else
      localStorage.removeItem('auth:knownEmail')
  }, knownEmail)
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

test.describe('Anmelde-Einstieg', () => {
  test.use({ viewport: PHONE })

  test('AE-001: Unbekanntes Gerät sieht im Kopf «Anmelden» und die Testzeit, auch auf dem Handy', async ({ page }) => {
    await startSignedOut(page)
    await page.goto('/')
    const header = page.getByRole('banner')
    await expect(header.getByRole('link', { name: 'Anmelden' })).toBeVisible()
    await expect(header.getByRole('button', { name: '30 Tage gratis testen' })).toBeVisible()
    await expectNoHorizontalScroll(page)

    await header.getByRole('link', { name: 'Anmelden' }).click()
    await expect(page).toHaveURL(/\/login$/)
    // Eine Seite für neue und bestehende Konten
    await expect(page.getByText('Schon Kunde? Gleiche E-Mail, gleiches Konto.')).toBeVisible()
    await expect(page.getByPlaceholder('E-Mail-Adresse')).toHaveValue('')
  })

  test('AE-002: Nach Anmelden und Abmelden kennt die Seite das Konto und füllt die E-Mail vor', async ({ page }) => {
    await startSignedOut(page)
    await page.goto('/login')
    await page.getByPlaceholder('E-Mail-Adresse').fill('kunde@example.ch')
    await page.getByRole('button', { name: 'Code senden' }).click()
    await page.getByPlaceholder('6-stelliger Code').fill('123456')
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await page.waitForURL(/\/dashboard/)

    await page.getByRole('button', { name: 'Menu' }).click()
    await page.getByText('Abmelden').click()
    await page.waitForURL(/\/login/)
    await expect(page.getByPlaceholder('E-Mail-Adresse')).toHaveValue('kunde@example.ch')

    // Startseite und Hypothesen-Seite bieten nur noch «Anmelden», keine Testzeit
    await page.goto('/')
    const header = page.getByRole('banner')
    await expect(header.getByRole('link', { name: 'Anmelden' })).toBeVisible()
    await expect(page.getByRole('button', { name: '30 Tage gratis testen' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Anmelden' }).first()).toBeVisible()
    await expectNoHorizontalScroll(page)
    await page.goto('/betrieb')
    await expect(page.getByRole('button', { name: '30 Tage gratis testen' })).toHaveCount(0)
    await expect(page.getByRole('main').getByRole('button', { name: 'Anmelden' })).toBeVisible()
  })

  test('AE-003: Bekanntes Konto sieht «Willkommen zurück» und kann die Adresse vergessen', async ({ page }) => {
    await startSignedOut(page, 'kunde@example.ch')
    await page.goto('/login')
    await expect(page.getByText('Willkommen zurück.')).toBeVisible()
    await expect(page.getByPlaceholder('E-Mail-Adresse')).toHaveValue('kunde@example.ch')

    await page.getByRole('button', { name: 'Andere E-Mail' }).click()
    await expect(page.getByPlaceholder('E-Mail-Adresse')).toHaveValue('')
    await page.goto('/')
    await expect(page.getByRole('banner').getByRole('button', { name: '30 Tage gratis testen' })).toBeVisible()
  })
})
