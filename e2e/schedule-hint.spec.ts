import { expect, test } from '@playwright/test'

// Helper: create a vehicle via UI and navigate to its detail page
async function createVehicleAndOpen(page: any, data: { make: string, model: string, year: string, mileage: string }) {
  await page.goto('/vehicles')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
  await page.getByLabel('Marke').fill(data.make)
  await page.getByLabel('Modell').fill(data.model)
  await page.getByLabel('Baujahr').fill(data.year)
  await page.getByLabel('Kilometerstand').fill(data.mileage)
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText(`${data.make} ${data.model}`)).toBeVisible()

  await page.locator('.q-card', { hasText: `${data.make} ${data.model}` }).click()
  await expect(page).toHaveURL(/\/vehicles\/.+/, { timeout: 5_000 })
}

async function waitForDb(page: any) {
  await page.waitForFunction(() => !!(window as any).__rxdb, { timeout: 10_000 })
}

test.describe('Schedule Hint', () => {
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
  })

  test('SH-002: hides warning banner when customSchedule exists', async ({ page }) => {
    await createVehicleAndOpen(page, {
      make: 'Honda',
      model: 'Civic',
      year: '2020',
      mileage: '35000',
    })

    // Set customSchedule directly via RxDB
    const vehicleId = page.url().match(/\/vehicles\/(.+)/)?.[1] || ''
    await waitForDb(page)
    await page.evaluate(async (vId: string) => {
      const db = (window as any).__rxdb
      const doc = await db.vehicles.findOne({ selector: { id: vId } }).exec()
      await doc.patch({
        customSchedule: [
          { type: 'oelwechsel', label: 'Ölwechsel', intervalKm: 10000, intervalMonths: 12 },
        ],
        updatedAt: new Date().toISOString(),
      })
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
  })
})
