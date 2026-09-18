import { clearInstantDB, expect, test, waitForInstantDB } from './fixtures/test-fixtures'

// Helper: create a vehicle via UI and navigate to its detail page
async function createVehicleAndOpen(page: any, data: { make: string, model: string, year: string, mileage: string }) {
  await page.goto('/vehicles')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
  await page.getByLabel(/Marke/).fill(data.make)
  await page.getByLabel(/Modell/).fill(data.model)

  const yearInput = page.getByLabel(/Baujahr/)
  await yearInput.click()
  await yearInput.press('Control+a')
  await yearInput.pressSequentially(data.year)

  const mileageInput = page.getByLabel(/Kilometerstand/)
  await mileageInput.click()
  await mileageInput.press('Control+a')
  await mileageInput.pressSequentially(data.mileage)

  await page.getByRole('button', { name: 'Speichern' }).click()
  // Nach dem Speichern führt die App direkt auf die Fahrzeugseite
  await expect(page).toHaveURL(/\/vehicles\/.+/, { timeout: 5_000 })
  await expect(page.getByRole('heading', { name: `${data.make} ${data.model}` })).toBeVisible()
}

async function waitForDb(page: any) {
  await waitForInstantDB(page)
}

// Helper: delete vehicle via UI
async function deleteVehicleViaUI(page: any) {
  await page.locator('button:has-text("Löschen")').first().click()
  await expect(page.getByText('Fahrzeug löschen?')).toBeVisible()
  await page.locator('[data-pc-name="dialog"]').getByRole('button', { name: 'Löschen' }).click()
  await expect(page).toHaveURL(/\/vehicles/)
}

test.describe('Schedule Hint', () => {
  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  test('SH-001: shows warning banner when no customSchedule exists', async ({ page }) => {
    await createVehicleAndOpen(page, {
      make: 'Fiat',
      model: 'Punto',
      year: '2018',
      mileage: '60000',
    })

    // Fahrzeugseite: Tab Wartungsplan (Standard) nennt die Quelle und bietet das Serviceheft als Hauptknopf an
    const source = page.locator('.plan-source')
    await expect(source).toContainText('allgemeinen Intervallen')
    await expect(source.getByRole('button', { name: 'Serviceheft fotografieren' })).toBeVisible()

    // Dashboard: banner should also be visible
    await page.goto('/')
    await expect(page.locator('.vehicle-title', { hasText: 'Fiat Punto' })).toBeVisible()
    await expect(page.locator('.schedule-hint')).toBeVisible()
    await expect(page.locator('.schedule-hint')).toContainText('allgemeine Wartungsintervalle')
    await expect(page.locator('.schedule-hint').getByRole('button', { name: 'Serviceheft Fiat Punto' })).toBeVisible()

    // DELETE (cleanup)
    await page.goto('/vehicles')
    await page.getByText('Fiat Punto').click()
    await deleteVehicleViaUI(page)
  })

  test('SH-002: hides warning banner when customSchedule exists', async ({ page }) => {
    await createVehicleAndOpen(page, {
      make: 'Honda',
      model: 'Civic',
      year: '2020',
      mileage: '35000',
    })

    // Set customSchedule directly via InstantDB
    const vehicleId = page.url().match(/\/vehicles\/(.+)/)?.[1] || ''
    await waitForDb(page)
    await page.evaluate(async (vId: string) => {
      const { db, tx } = (window as any).__instantdb
      await db.transact([
        tx.vehicles[vId].update({
          customSchedule: [
            { type: 'oelwechsel', label: 'Ölwechsel', intervalKm: 10000, intervalMonths: 12 },
          ],
        }),
      ])
    }, vehicleId)

    // Reload to pick up the change
    await page.reload()
    await expect(page.getByText('Honda Civic')).toBeVisible()

    // Fahrzeugseite: Plan aus dem Serviceheft statt allgemeiner Intervalle
    await expect(page.locator('.plan-source')).toContainText('Intervalle aus dem Serviceheft')
    await expect(page.locator('.plan-source')).not.toContainText('allgemeinen Intervallen')
    await expect(page.locator('.plan-item')).toHaveCount(1)

    // Dashboard: banner should NOT be visible
    await page.goto('/')
    await expect(page.getByText('Honda Civic')).toBeVisible()
    await expect(page.locator('.schedule-hint')).not.toBeVisible()

    // DELETE (cleanup)
    await page.goto('/vehicles')
    await page.getByText('Honda Civic').click()
    await deleteVehicleViaUI(page)
  })
})
