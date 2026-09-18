import type { Page } from '@playwright/test'
import path from 'node:path'
import { clearInstantDB, countEntities, expect, mockInvoiceScan, test, waitForInstantDB } from './fixtures/test-fixtures'

// Serviceheft ohne Chat: Seite fotografieren, Intervalle und Stempel prüfen, speichern. Mistral gemockt
// (SCAN_SERVICE_BOOK), das Bild ist nur Träger für den Upload.

const photo = path.join(import.meta.dirname, 'fixtures', 'fahrzeugausweis-schweiz.jpg')

async function seedVehicle(page: Page, opts: { maintenance?: { type: string, doneAt: string } } = {}): Promise<string> {
  await page.goto('/')
  await waitForInstantDB(page)
  return page.evaluate(async (o) => {
    const { db, tx, id: genId } = (window as any).__instantdb
    const vId = genId()
    const now = new Date().toISOString()
    const ops: any[] = [tx.vehicles[vId].update({ make: 'Toyota', model: 'Yaris', year: 2019, mileage: 60000, licensePlate: 'TG 5', createdAt: now, updatedAt: now })]
    if (o.maintenance)
      ops.push(tx.maintenances[genId()].update({ vehicleId: vId, type: o.maintenance.type, doneAt: o.maintenance.doneAt, mileageAtService: 61000, status: 'done', createdAt: now, updatedAt: now }))
    await db.transact(ops)
    return vId as string
  }, opts)
}

test.describe('Serviceheft ohne Chat', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('SB-001: Foto der Serviceheft-Seite setzt Intervalle und übernimmt Stempel', async ({ page }) => {
    await mockInvoiceScan(page)
    const vehicleId = await seedVehicle(page)
    await page.goto(`/vehicles/${vehicleId}`)
    await page.locator('.plan-source').getByRole('button', { name: 'Serviceheft fotografieren' }).click()

    const dialog = page.getByTestId('service-book-dialog')
    await expect(dialog).toBeVisible()
    // Start: allgemeine Intervalle als bearbeitbare Zeilen
    await expect(dialog.locator('.interval-row[data-type]')).toHaveCount(9)

    await dialog.locator('input[type="file"]').setInputFiles(photo)
    await expect(dialog.getByRole('status')).toHaveText('2 Intervalle übernommen, 2 Einträge gefunden. Bitte prüfen.', { timeout: 60_000 })
    await expect(dialog.getByLabel('Ölwechsel Intervall Kilometer')).toHaveValue('20’000 km')
    await expect(dialog.locator('.interval-row[data-type="kuehlung"]')).toBeVisible()
    await expect(dialog.locator('.book-entry')).toHaveCount(2)

    // Klimaanlage gilt bei diesem Auto nicht: Monate auf 0 setzen, Zeile fällt beim Speichern weg
    const klima = dialog.getByLabel('Klimaanlage Service Intervall Monate')
    await klima.click()
    await klima.press('Control+a')
    await klima.press('Backspace')
    await klima.pressSequentially('0')
    await dialog.getByRole('button', { name: 'Plan und 2 Einträge speichern' }).click()
    await expect(dialog).not.toBeVisible()

    await expect(page.locator('.plan-source')).toContainText('Intervalle aus dem Serviceheft')
    const plan = page.getByRole('tabpanel', { name: 'Wartungsplan' })
    await expect(plan.locator('.plan-item', { hasText: 'Ölwechsel' })).toContainText('20\'000 km / 12 Monate')
    await expect(plan.locator('.plan-item', { hasText: 'Kühlmittel' })).toContainText('60 Monate')
    await expect(plan.locator('.plan-item', { hasText: 'Klimaanlage' })).toHaveCount(0)
    expect(await countEntities(page, 'maintenances')).toBe(2)
    // Stempel mit 61'200 km hebt den Fahrzeugstand
    await expect(page.getByText('61\'200 km').first()).toBeVisible()
  })

  test('SB-002: schon erfasste Arbeit ist abgewählt, Intervalle gehen auch ohne Scan', async ({ page }) => {
    await mockInvoiceScan(page)
    const vehicleId = await seedVehicle(page, { maintenance: { type: 'oelwechsel', doneAt: '2025-06-12' } })
    await page.goto(`/vehicles/${vehicleId}`)
    await page.locator('.plan-source').getByRole('button', { name: 'Serviceheft fotografieren' }).click()
    const dialog = page.getByTestId('service-book-dialog')

    await dialog.locator('input[type="file"]').setInputFiles(photo)
    await expect(dialog.getByRole('status')).toContainText('1 schon erfasst', { timeout: 60_000 })
    const oil = dialog.locator('.book-entry', { hasText: 'Ölwechsel' })
    await expect(oil).toContainText('schon erfasst')
    await expect(oil.getByRole('checkbox')).not.toBeChecked()
    await dialog.getByRole('button', { name: 'Plan und 1 Eintrag speichern' }).click()
    await expect(dialog).not.toBeVisible()
    expect(await countEntities(page, 'maintenances')).toBe(2)
  })

  test('SB-003: Dashboard-Hinweis öffnet das Serviceheft für das Fahrzeug', async ({ page }) => {
    await seedVehicle(page)
    await page.goto('/dashboard')
    const hint = page.getByRole('region', { name: 'Fällige Arbeiten' }).locator('.schedule-hint')
    await expect(hint).toContainText('allgemeine Wartungsintervalle')
    await hint.getByRole('button', { name: 'Serviceheft Toyota Yaris' }).click()
    const dialog = page.getByTestId('service-book-dialog')
    await expect(dialog).toBeVisible()

    // Von Hand: Ölwechsel auf 10'000 km
    const km = dialog.getByLabel('Ölwechsel Intervall Kilometer')
    await km.click()
    await km.press('Control+a')
    await km.pressSequentially('10000')
    await dialog.getByRole('button', { name: 'Plan speichern' }).click()
    await expect(dialog).not.toBeVisible()
    await expect(hint).not.toBeVisible()
  })
})
