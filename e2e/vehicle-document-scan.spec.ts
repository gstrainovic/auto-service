import path from 'node:path'
import process from 'node:process'
import { expect, test } from '@playwright/test'
import { clearInstantDB } from './fixtures/db-cleanup'

const AI_PROVIDER = process.env.VITE_AI_PROVIDER || 'mistral'
const AI_API_KEY = process.env.VITE_AI_API_KEY || ''

test.describe('Vehicle Document Scan', () => {
  test.setTimeout(120_000)
  test.skip(AI_PROVIDER !== 'ollama' && !AI_API_KEY, 'No API key set and not using Ollama')

  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('VD-001: scan a Kaufvertrag and create vehicle', async ({ page }) => {
    // Configure AI provider
    await page.goto('/')
    await page.evaluate(({ provider, key }) => {
      localStorage.setItem('ai_provider', provider)
      localStorage.setItem('ai_api_key', key)
    }, { provider: AI_PROVIDER, key: AI_API_KEY })
    await page.reload()

    // Go to scan page, select Kaufvertrag tab
    await page.goto('/scan')
    await page.getByRole('tab', { name: 'Kaufvertrag' }).click()

    // Upload the Kaufvertrag image
    await page.getByText('Datei').click()
    const filePath = path.join(import.meta.dirname, 'fixtures', 'test-kaufvertrag.png')
    await page.locator('input[type="file"]').setInputFiles(filePath)

    // Wait for AI parsing
    await expect(page.getByText('KI liest Fahrzeugdaten...')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Erkannte Fahrzeugdaten')).toBeVisible({ timeout: 60_000 })

    // Verify parsed data
    const resultCard = page.locator('.q-card', { hasText: 'Erkannte Fahrzeugdaten' })
    await expect(resultCard.getByText(/Volkswagen/i)).toBeVisible()
    await expect(resultCard.getByText(/Golf/i)).toBeVisible()

    // Create vehicle
    await page.getByRole('button', { name: 'Fahrzeug anlegen' }).click()

    // Should redirect to vehicles page
    await expect(page).toHaveURL(/\/vehicles/, { timeout: 10_000 })
    await expect(page.getByText(/Volkswagen/i).first()).toBeVisible()
    await expect(page.getByText(/Golf/i).first()).toBeVisible()
  })

  test('VD-002: scan a Service-Heft and add to vehicle', async ({ page }) => {
    // Configure AI provider
    await page.goto('/')
    await page.evaluate(({ provider, key }) => {
      localStorage.setItem('ai_provider', provider)
      localStorage.setItem('ai_api_key', key)
    }, { provider: AI_PROVIDER, key: AI_API_KEY })

    // First create a vehicle
    await page.goto('/vehicles')
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    await page.getByLabel('Marke').fill('VW')
    await page.getByLabel('Modell').fill('Golf VIII')
    await page.getByLabel('Baujahr').fill('2021')
    await page.getByLabel('Kilometerstand').fill('38500')
    await page.getByLabel('Kennzeichen').fill('B-HS 4321')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('VW Golf VIII')).toBeVisible()

    // Go to scan page, select Service-Heft tab
    await page.goto('/scan')
    await page.getByRole('tab', { name: 'Service-Heft' }).click()

    // Select vehicle
    await page.getByLabel('Fahrzeug wählen').click()
    await page.getByText('VW Golf VIII').click()

    // Upload the Service-Heft image
    await page.getByText('Datei').click()
    const filePath = path.join(import.meta.dirname, 'fixtures', 'test-service-heft.png')
    await page.locator('input[type="file"]').setInputFiles(filePath)

    // Wait for AI parsing
    await expect(page.getByText('KI analysiert Service-Heft...')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Erkannte Service-Einträge')).toBeVisible({ timeout: 60_000 })

    // Verify parsed entries exist
    const resultCard = page.locator('.q-card', { hasText: 'Erkannte Service-Einträge' })
    const entries = resultCard.locator('.q-item')
    expect(await entries.count()).toBeGreaterThanOrEqual(1)

    // Save to vehicle
    await page.getByRole('button', { name: 'Zu Fahrzeug hinzufügen' }).click()
    await expect(page.getByText('Erkannte Service-Einträge')).not.toBeVisible({ timeout: 10_000 })

    // Dashboard should show maintenance status
    await page.goto('/')
    await expect(page.getByText('VW Golf VIII')).toBeVisible()
    const mainSection = page.locator('main')
    await expect(mainSection.getByText(/Zuletzt:/).first()).toBeVisible({ timeout: 10_000 })
  })
})
