import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

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
  await expect(page.getByText(`${data.make} ${data.model}`)).toBeVisible()

  await page.locator('.vehicle-card', { hasText: `${data.make} ${data.model}` }).click()
  await expect(page).toHaveURL(/\/vehicles\/.+/, { timeout: 5_000 })
}

async function waitForDb(page: any) {
  await page.waitForFunction(() => !!(window as any).__instantdb, { timeout: 10_000 })
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

    // VehicleDetailPage: banner should be visible on maintenance tab (default)
    await expect(page.locator('.schedule-hint')).toBeVisible()
    await expect(page.locator('.schedule-hint')).toContainText('allgemeinen Intervallen')

    // Dashboard: banner should also be visible
    await page.goto('/')
    await expect(page.getByText('Fiat Punto')).toBeVisible()
    await expect(page.locator('.schedule-hint')).toBeVisible()
    await expect(page.locator('.schedule-hint')).toContainText('Allgemeine Wartungsintervalle')

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

    // VehicleDetailPage: banner should NOT be visible
    await expect(page.locator('.schedule-hint')).not.toBeVisible()
    // Custom schedule should be shown instead
    await expect(page.getByText('Fahrzeugspezifischer Wartungsplan')).toBeVisible()

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
