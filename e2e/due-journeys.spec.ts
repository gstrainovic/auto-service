import type { Page } from '@playwright/test'
import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

// Kernablauf Fälligkeit: Fahrzeug anlegen, letzte Wartungen nachtragen, Fälliges im Dashboard sehen und erledigen

const isoDaysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)

async function seed(page: Page, vehicles: { make: string, model: string, mileage: number, maintenances: { type: string, daysAgo: number, km?: number }[] }[]): Promise<string[]> {
  await page.goto('/')
  await page.waitForFunction(() => !!(window as any).__instantdb, { timeout: 30_000 })
  const data = vehicles.map(v => ({ ...v, maintenances: v.maintenances.map(m => ({ ...m, doneAt: isoDaysAgo(m.daysAgo) })) }))
  return page.evaluate(async (input) => {
    const { db, tx, id: genId } = (window as any).__instantdb
    const now = new Date().toISOString()
    const ids: string[] = []
    const ops: any[] = []
    for (const v of input) {
      const vId = genId()
      ids.push(vId)
      ops.push(tx.vehicles[vId].update({ make: v.make, model: v.model, year: 2020, mileage: v.mileage, licensePlate: '', createdAt: now, updatedAt: now }))
      for (const m of v.maintenances)
        ops.push(tx.maintenances[genId()].update({ vehicleId: vId, type: m.type, doneAt: m.doneAt, mileageAtService: m.km ?? null, status: 'done', createdAt: now, updatedAt: now }))
    }
    await db.transact(ops)
    return ids
  }, data)
}

test.describe('Fälligkeit als Ablauf', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test.describe('nach dem Anlegen', () => {
    test.use({ keepLastServicesDialog: true })

    test('DJ-001: neues Fahrzeug fragt nach den letzten Wartungen, danach ist die Fälligkeit bekannt', async ({ page }) => {
      await page.goto('/vehicles?action=add')
      const form = page.getByRole('dialog', { name: 'Neues Fahrzeug' })
      await form.getByLabel('Marke').fill('Skoda')
      await form.getByLabel('Modell').fill('Octavia')
      await form.getByRole('button', { name: 'Speichern' }).click()

      const dialog = page.getByTestId('last-services-dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog).toContainText('Skoda Octavia')
      await expect(dialog.getByRole('button', { name: 'Speichern' })).toBeDisabled()
      // Ölwechsel vor gut 13 Monaten bei 80'000 km: überfällig
      await dialog.locator('#last-oelwechsel-date').fill(isoDaysAgo(400))
      await dialog.locator('#last-oelwechsel-km').pressSequentially('80000')
      await dialog.locator('#last-tuev-date').fill(isoDaysAgo(100))
      await dialog.getByRole('button', { name: '2 Einträge speichern' }).click()
      await expect(dialog).not.toBeVisible()

      const card = page.locator('.vehicle-card', { hasText: 'Skoda Octavia' })
      await expect(card).toContainText('Ölwechsel überfällig')

      await page.goto('/dashboard')
      const due = page.getByRole('region', { name: 'Fällige Arbeiten' })
      await expect(due.locator('.fleet-due-item')).toHaveCount(1)
      await expect(due.locator('.fleet-due-item')).toContainText('Ölwechsel')
      await expect(due.locator('.fleet-due-item')).toContainText('Skoda Octavia')
      await expect(due.locator('.fleet-due-item')).toContainText(/fällig seit \d{2}\.\d{2}\.\d{4}/)
      // Nachgetragener Kilometerstand hebt den Fahrzeugstand
      await expect(page.locator('.vehicle-section', { hasText: 'Skoda Octavia' }).locator('.vehicle-subtitle')).toContainText('80\'000 km')
    })

    test('DJ-002: «Später» schliesst ohne Einträge, das Dashboard bietet das Nachtragen wieder an', async ({ page }) => {
      await page.goto('/vehicles?action=add')
      const form = page.getByRole('dialog', { name: 'Neues Fahrzeug' })
      await form.getByLabel('Marke').fill('Dacia')
      await form.getByLabel('Modell').fill('Duster')
      await form.getByRole('button', { name: 'Speichern' }).click()
      await page.getByTestId('last-services-dialog').getByRole('button', { name: 'Später' }).click()

      await expect(page.locator('.vehicle-card', { hasText: 'Dacia Duster' })).toContainText('Noch keine Wartung erfasst')
      await page.goto('/dashboard')
      const section = page.locator('.vehicle-section', { hasText: 'Dacia Duster' })
      await expect(section.locator('.vehicle-progress')).toHaveText('Noch keine Wartung erfasst')
      // neun «Kein Eintrag»-Zeilen bleiben weg, stattdessen ein klarer nächster Schritt
      await expect(section.locator('.maintenance-item')).toHaveCount(0)
      await section.getByRole('button', { name: 'Letzte Wartungen nachtragen' }).click()
      await expect(page.getByTestId('last-services-dialog')).toContainText('Dacia Duster')
    })
  })

  test('DJ-003: Fälligkeitsliste über alle Fahrzeuge, überfällig zuerst', async ({ page }) => {
    await seed(page, [
      // Ölwechsel vor 350 Tagen: bald fällig
      { make: 'Fiat', model: 'Ducato', mileage: 40000, maintenances: [{ type: 'oelwechsel', daysAgo: 350, km: 39000 }] },
      // MFK vor 3 Jahren: überfällig
      { make: 'VW', model: 'Caddy', mileage: 68500, maintenances: [{ type: 'tuev', daysAgo: 3 * 365 }, { type: 'oelwechsel', daysAgo: 20, km: 68000 }] },
    ])
    await page.goto('/dashboard')
    const items = page.getByRole('region', { name: 'Fällige Arbeiten' }).locator('.fleet-due-item')
    await expect(items).toHaveCount(2)
    await expect(items.nth(0)).toContainText('MFK / Prüfung')
    await expect(items.nth(0)).toContainText('VW Caddy')
    await expect(items.nth(0)).toContainText('Überfällig')
    await expect(items.nth(1)).toContainText('Ölwechsel')
    await expect(items.nth(1)).toContainText('Fiat Ducato')
    await expect(items.nth(1)).toContainText('Bald fällig')
    // Arbeiten ohne Eintrag sind pro Fahrzeug zugeklappt
    const caddy = page.locator('.vehicle-section', { hasText: 'VW Caddy' })
    await expect(caddy.locator('.maintenance-item', { hasText: 'Kein Eintrag' })).toHaveCount(0)
    await caddy.getByRole('button', { name: /7 Arbeiten ohne Eintrag anzeigen/ }).click()
    await expect(caddy.locator('.maintenance-item', { hasText: 'Kein Eintrag' })).toHaveCount(7)
  })

  test('DJ-004: «Erledigt eintragen» nimmt die Arbeit aus der Liste und hebt den Kilometerstand', async ({ page }) => {
    await seed(page, [{ make: 'VW', model: 'Caddy', mileage: 68500, maintenances: [{ type: 'tuev', daysAgo: 3 * 365 }] }])
    await page.goto('/dashboard')
    const due = page.getByRole('region', { name: 'Fällige Arbeiten' })
    await due.locator('.fleet-due-item', { hasText: 'MFK / Prüfung' }).getByRole('button', { name: 'Erledigt eintragen' }).click()

    const dialog = page.getByRole('dialog', { name: 'MFK / Prüfung erledigt · VW Caddy' })
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('#maintenance-date')).toHaveValue(new Date().toISOString().slice(0, 10))
    const km = dialog.locator('#maintenance-mileage input')
    await km.click()
    await km.press('Control+a')
    await km.pressSequentially('69200')
    await dialog.getByRole('button', { name: 'Speichern' }).click()
    await expect(dialog).not.toBeVisible()

    await expect(due.locator('.fleet-due-item')).toHaveCount(0)
    await expect(due).toContainText('Nichts überfällig')
    await expect(page.locator('.vehicle-section', { hasText: 'VW Caddy' }).locator('.vehicle-subtitle')).toContainText('69\'200 km')
  })

  test('DJ-006: vereinbarter Termin steht an der fälligen Arbeit', async ({ page }) => {
    const [vehicleId] = await seed(page, [{ make: 'VW', model: 'Caddy', mileage: 68500, maintenances: [{ type: 'tuev', daysAgo: 3 * 365 }] }])
    await page.goto('/dashboard')
    const due = page.getByRole('region', { name: 'Fällige Arbeiten' })
    await due.locator('.fleet-due-item', { hasText: 'MFK / Prüfung' }).getByRole('button', { name: 'Erledigt eintragen' }).click()

    // Termin in der Zukunft statt erledigt
    const dialog = page.getByRole('dialog', { name: 'MFK / Prüfung erledigt · VW Caddy' })
    await dialog.locator('#maintenance-status').click()
    await page.getByRole('option', { name: 'Geplant (Termin vereinbart)' }).click()
    const inTwoWeeks = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)
    await dialog.locator('#maintenance-date').fill(inTwoWeeks)
    await dialog.getByRole('button', { name: 'Speichern' }).click()
    await expect(dialog).not.toBeVisible()

    const item = due.locator('.fleet-due-item', { hasText: 'MFK / Prüfung' })
    await expect(item).toContainText('Termin am')
    // Eintrag steht auf der Fahrzeugseite als «Geplant», nicht als erledigte Wartung
    await page.goto(`/vehicles/${vehicleId}`)
    await expect(page.locator('.maintenance-item', { hasText: 'MFK / Prüfung' }).first()).toContainText('Geplant')
  })

  test('DJ-007: Kilometerstand lässt sich im Dashboard direkt nachführen', async ({ page }) => {
    await seed(page, [{ make: 'VW', model: 'Caddy', mileage: 68500, maintenances: [{ type: 'oelwechsel', daysAgo: 40, km: 60000 }] }])
    await page.goto('/dashboard')
    const section = page.locator('.vehicle-section', { hasText: 'VW Caddy' })
    await section.getByRole('button', { name: 'Kilometerstand VW Caddy ändern' }).click()

    const dialog = page.getByTestId('mileage-dialog')
    await expect(dialog).toContainText('bisher 68\'500 km')
    const input = dialog.locator('#mileage-input')
    await input.click()
    await input.press('Control+a')
    await input.pressSequentially('74200')
    await dialog.getByRole('button', { name: 'Speichern' }).click()
    await expect(dialog).not.toBeVisible()

    await expect(section.locator('.vehicle-subtitle')).toContainText('74\'200 km')
    // Ölwechsel wird nach Kilometern fällig: 60'000 + 15'000 = 75'000, also bald fällig
    await expect(page.getByRole('region', { name: 'Fällige Arbeiten' })).toContainText('Ölwechsel')
  })

  test('DJ-005: Link aus der Erinnerungs-Mail springt zum Fahrzeug', async ({ page }) => {
    const names = Array.from({ length: 5 }, (_, i) => ({ make: 'Opel', model: `Vivaro ${i + 1}`, mileage: 10000, maintenances: [{ type: 'tuev', daysAgo: 3 * 365 }] }))
    const ids = await seed(page, names)
    await page.setViewportSize({ width: 390, height: 700 })
    await page.goto(`/dashboard#fahrzeug-${ids[4]}`)
    await expect(page.locator(`#fahrzeug-${ids[4]}`)).toBeInViewport({ timeout: 10_000 })
  })
})
