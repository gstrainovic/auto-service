import type { Page } from '@playwright/test'
import { clearInstantDB, expect, test, waitForInstantDB } from './fixtures/test-fixtures'

// Herkunft am Datensatz (`source`): über welchen Einstieg Fahrzeuge, Rechnungen und Wartungen entstehen.
// Grundlage für Auswertungen wie «wie viele Rechnungen kommen über den Chat», ohne Analytics-Dienst.

async function sources(page: Page, entity: string): Promise<string[]> {
  return page.evaluate(async (name) => {
    const { db } = (window as any).__instantdb
    const result = await db.queryOnce({ [name]: {} })
    return ((result.data[name] || []) as { source?: string }[]).map(e => e.source ?? '(leer)').sort()
  }, entity)
}

async function seedVehicle(page: Page, maintenance = false): Promise<string> {
  await page.goto('/')
  await waitForInstantDB(page)
  return page.evaluate(async ({ maintenance, doneAt }) => {
    const { db, tx, id: genId } = (window as any).__instantdb
    const now = new Date().toISOString()
    const vId = genId()
    const ops: any[] = [tx.vehicles[vId].update({ make: 'VW', model: 'Caddy', year: 2019, mileage: 68500, licensePlate: 'SG 1', createdAt: now, updatedAt: now })]
    if (maintenance)
      ops.push(tx.maintenances[genId()].update({ vehicleId: vId, type: 'tuev', doneAt, status: 'done', createdAt: now, updatedAt: now }))
    await db.transact(ops)
    return vId
  }, { maintenance, doneAt: new Date(Date.now() - 3 * 365 * 86_400_000).toISOString().slice(0, 10) })
}

test.describe('Herkunft am Datensatz', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('HK-001: Fahrzeug aus dem Formular trägt «formular»', async ({ page }) => {
    await page.goto('/vehicles?action=add')
    const form = page.getByRole('dialog', { name: 'Neues Fahrzeug' })
    await form.getByLabel('Marke').fill('Skoda')
    await form.getByLabel('Modell').fill('Octavia')
    await form.getByRole('button', { name: 'Speichern' }).click()
    await page.waitForURL(/\/vehicles\/.+/)
    expect(await sources(page, 'vehicles')).toEqual(['formular'])
  })

  test('HK-002: Rechnung aus dem Formular, ihre Wartungen erben die Herkunft', async ({ page }) => {
    const id = await seedVehicle(page)
    await page.goto(`/vehicles/${id}`)
    await page.getByRole('tab', { name: 'Rechnungen' }).click()
    await page.getByRole('button', { name: 'Rechnung hinzufügen' }).click()
    const dialog = page.locator('[data-pc-name="dialog"]')
    await dialog.locator('#invoice-date').fill('2026-02-08')
    await dialog.locator('#invoice-amount input').fill('350')
    // Mit Kategorie entsteht aus der Rechnung eine Wartung
    await dialog.locator('#invoice-category').click()
    await page.getByRole('option', { name: 'Ölwechsel' }).click()
    await dialog.getByRole('button', { name: 'Speichern' }).click()
    await expect(dialog).not.toBeVisible()
    expect(await sources(page, 'invoices')).toEqual(['formular'])
    const maintenances = await sources(page, 'maintenances')
    expect(maintenances.length).toBeGreaterThan(0)
    expect(new Set(maintenances)).toEqual(new Set(['formular']))
  })

  test('HK-003: Wartungsplan und Verlauf unterscheiden sich', async ({ page }) => {
    const id = await seedVehicle(page)
    await page.goto(`/vehicles/${id}`)
    await page.getByRole('button', { name: 'Ölwechsel eintragen' }).click()
    const entry = page.getByRole('dialog', { name: 'Ölwechsel eintragen' })
    await entry.locator('#maintenance-date').fill('2025-05-10')
    await entry.getByRole('button', { name: 'Speichern' }).click()
    await expect(entry).not.toBeVisible()

    await page.getByRole('tab', { name: 'Verlauf' }).click()
    await page.getByRole('button', { name: 'Wartung hinzufügen' }).click()
    const form = page.getByRole('dialog', { name: 'Neue Wartung' })
    await form.locator('#maintenance-category').click()
    await page.getByRole('option', { name: 'Inspektion / Service' }).click()
    await form.locator('#maintenance-date').fill('2025-06-01')
    await form.getByRole('button', { name: 'Speichern' }).click()
    await expect(form).not.toBeVisible()

    expect(await sources(page, 'maintenances')).toEqual(['formular', 'wartungsplan'])
  })

  test('HK-004: «Erledigt eintragen» im Dashboard trägt «dashboard»', async ({ page }) => {
    await seedVehicle(page, true)
    await page.goto('/dashboard')
    const due = page.getByRole('region', { name: 'Fällige Arbeiten' })
    await due.locator('.fleet-due-item', { hasText: 'MFK / Prüfung' }).getByRole('button', { name: 'Erledigt eintragen' }).click()
    const dialog = page.getByRole('dialog', { name: 'MFK / Prüfung erledigt · VW Caddy' })
    await dialog.getByRole('button', { name: 'Speichern' }).click()
    await expect(dialog).not.toBeVisible()
    // der Seed hat keine Herkunft, der neue Eintrag schon
    expect(await sources(page, 'maintenances')).toEqual(['(leer)', 'dashboard'])
  })
})
