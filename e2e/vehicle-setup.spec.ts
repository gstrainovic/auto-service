import type { Page } from '@playwright/test'
import { clearInstantDB, expect, test, waitForInstantDB } from './fixtures/test-fixtures'

// Einrichtung eines Fahrzeugs: Checkliste auf der Fahrzeugseite, Wartungsplan als eigener Tab, ein Weg pro Aufgabe

const isoDaysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)

async function seedVehicle(page: Page, opts: { vin?: string, schedule?: boolean, maintenance?: boolean, invoice?: boolean } = {}): Promise<string> {
  await page.goto('/')
  await waitForInstantDB(page)
  return page.evaluate(async ({ opts, doneAt }) => {
    const { db, tx, id: genId } = (window as any).__instantdb
    const now = new Date().toISOString()
    const vId = genId()
    const ops: any[] = [tx.vehicles[vId].update({
      make: 'VW',
      model: 'Caddy',
      year: 2019,
      mileage: 68500,
      licensePlate: 'SG 12345',
      vin: opts.vin ?? '',
      customSchedule: opts.schedule ? [{ type: 'oelwechsel', label: 'Motoröl', intervalKm: 20000, intervalMonths: 24 }] : [],
      createdAt: now,
      updatedAt: now,
    })]
    if (opts.maintenance)
      ops.push(tx.maintenances[genId()].update({ vehicleId: vId, type: 'oelwechsel', doneAt, mileageAtService: 60000, status: 'done', createdAt: now, updatedAt: now }))
    if (opts.invoice)
      ops.push(tx.invoices[genId()].update({ vehicleId: vId, workshopName: 'Garage Muster', date: doneAt, totalAmount: 250, currency: 'CHF', items: [], createdAt: now, updatedAt: now }))
    await db.transact(ops)
    return vId
  }, { opts, doneAt: isoDaysAgo(40) })
}

test.describe('Einrichtung Fahrzeug', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('EF-001: nach dem Anlegen direkt auf der Fahrzeugseite mit Checkliste und Wartungsplan', async ({ page }) => {
    await page.goto('/vehicles?action=add')
    const form = page.getByRole('dialog', { name: 'Neues Fahrzeug' })
    await form.getByLabel('Marke').fill('Skoda')
    await form.getByLabel('Modell').fill('Octavia')
    await form.getByLabel('Baujahr').fill('2018')
    await form.getByLabel('Kontrollschild').fill('ZH 4711')
    await form.getByRole('button', { name: 'Speichern' }).click()

    await expect(page).toHaveURL(/\/vehicles\/.+/)
    await expect(page.getByRole('heading', { name: 'Skoda Octavia' })).toBeVisible()
    const setup = page.getByTestId('setup-checklist')
    await expect(setup).toBeVisible()
    // Kaufvertrag oder Handeingabe: die Lücke bleibt sichtbar
    await expect(setup.locator('[data-step="ausweis"]')).toContainText('Fehlt noch: Fahrgestellnummer')
    // Der erste offene Schritt ist der Hauptknopf
    await expect(setup.getByRole('button', { name: 'Fahrzeugausweis fotografieren' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Wartungsplan' })).toHaveAttribute('aria-selected', 'true')
    // Kein Dialog «Wann wurde zuletzt …?» mehr
    await expect(page.getByTestId('last-services-dialog')).toHaveCount(0)
  })

  test('EF-002: im Wartungsplan fragt jede Arbeit selbst nach «zuletzt»', async ({ page }) => {
    const id = await seedVehicle(page)
    await page.goto(`/vehicles/${id}`)
    const plan = page.getByRole('tabpanel', { name: 'Wartungsplan' })
    const oil = plan.locator('.plan-item', { hasText: 'Ölwechsel' })
    await expect(oil).toContainText('noch nie erfasst')

    await oil.getByRole('button', { name: 'Ölwechsel eintragen' }).click()
    const dialog = page.getByRole('dialog', { name: 'Ölwechsel eintragen' })
    // Noch nie erfasst: gefragt ist «wann zuletzt», nicht heute
    await expect(dialog.locator('#maintenance-date')).toHaveValue('')
    await dialog.locator('#maintenance-date').fill(isoDaysAgo(400))
    const km = dialog.locator('#maintenance-mileage input')
    await km.click()
    await km.pressSequentially('80000')
    await dialog.getByRole('button', { name: 'Speichern' }).click()
    await expect(dialog).not.toBeVisible()

    await expect(oil).toContainText(/Zuletzt: \d{2}\.\d{2}\.\d{4} bei 80'000 km/)
    await expect(oil).toContainText('Überfällig')
    await expect(page.getByTestId('setup-checklist').locator('[data-step="wartungen"]')).toHaveClass(/done/)
    await expect(page.locator('.vehicle-mileage')).toContainText('80\'000 km')
  })

  test('EF-003: Serviceheft fotografieren ist der Hauptknopf im Wartungsplan', async ({ page }) => {
    const id = await seedVehicle(page)
    await page.goto(`/vehicles/${id}`)
    const plan = page.getByRole('tabpanel', { name: 'Wartungsplan' })
    await expect(plan).toContainText('allgemeinen Intervallen')
    await plan.getByRole('button', { name: 'Serviceheft fotografieren' }).click()
    await expect(page.getByTestId('service-book-dialog')).toBeVisible()
  })

  test('EF-004: Verlauf zeigt nur die erfassten Wartungen, mit einem Knopf zum Hinzufügen', async ({ page }) => {
    const id = await seedVehicle(page, { maintenance: true })
    await page.goto(`/vehicles/${id}`)
    await page.getByRole('tab', { name: 'Verlauf' }).click()
    const history = page.getByRole('tabpanel', { name: 'Verlauf' })
    await expect(history.locator('.maintenance-item')).toHaveCount(1)
    await expect(history.getByRole('button', { name: 'Wartung hinzufügen' })).toBeVisible()
    await expect(history.getByRole('button', { name: /Serviceheft|nachtragen/ })).toHaveCount(0)
  })

  test('EF-005: vollständig eingerichtet heisst keine Checkliste', async ({ page }) => {
    const id = await seedVehicle(page, { vin: 'WVWZZZ2KZ9X000001', schedule: true, maintenance: true, invoice: true })
    await page.goto(`/vehicles/${id}`)
    await expect(page.getByRole('heading', { name: 'VW Caddy' })).toBeVisible()
    await expect(page.getByTestId('setup-checklist')).toHaveCount(0)
    // Plan aus dem Serviceheft statt allgemeiner Intervalle
    const plan = page.getByRole('tabpanel', { name: 'Wartungsplan' })
    await expect(plan.locator('.plan-item')).toHaveCount(1)
    await expect(plan.locator('.plan-item')).toContainText('Motoröl')
    await expect(plan.locator('.plan-item')).toContainText('20\'000 km / 24 Monate')
  })

  test('EF-006: «Ausblenden» blendet die Checkliste für dieses Fahrzeug dauerhaft aus', async ({ page }) => {
    const id = await seedVehicle(page)
    await page.goto(`/vehicles/${id}`)
    const setup = page.getByTestId('setup-checklist')
    await setup.getByRole('button', { name: 'Ausblenden' }).click()
    await expect(setup).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'VW Caddy' })).toBeVisible()
    await expect(page.getByTestId('setup-checklist')).toHaveCount(0)
  })
})
