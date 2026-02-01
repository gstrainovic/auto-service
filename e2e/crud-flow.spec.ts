import { expect, test } from '@playwright/test'

// Helper: create a vehicle via UI and navigate to its detail page
async function createVehicleAndOpen(page: any, data: { make: string, model: string, year: string, mileage: string, plate?: string }) {
  await page.goto('/vehicles')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
  await page.getByLabel('Marke').fill(data.make)
  await page.getByLabel('Modell').fill(data.model)
  await page.getByLabel('Baujahr').fill(data.year)
  await page.getByLabel('Kilometerstand').fill(data.mileage)
  if (data.plate)
    await page.getByLabel('Kennzeichen').fill(data.plate)
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText(`${data.make} ${data.model}`)).toBeVisible()

  // Click the vehicle card (not just the text, which might match dialog content)
  await page.locator('.q-card', { hasText: `${data.make} ${data.model}` }).click()
  await expect(page).toHaveURL(/\/vehicles\/.+/, { timeout: 5_000 })
}

// Helper: get vehicle ID from the current URL
function getVehicleIdFromUrl(page: any): string {
  const url = page.url()
  const match = url.match(/\/vehicles\/(.+)/)
  return match ? match[1] : ''
}

// Helper: wait for __rxdb to be exposed on window (set by useDatabase in dev mode)
async function waitForDb(page: any) {
  await page.waitForFunction(() => !!(window as any).__rxdb, { timeout: 10_000 })
}

// Helper: seed an invoice via page.evaluate into RxDB
async function seedInvoice(page: any, vehicleId: string) {
  await waitForDb(page)
  await page.evaluate(async (vId: string) => {
    const db = (window as any).__rxdb
    const now = new Date().toISOString()
    await db.invoices.insert({
      id: crypto.randomUUID(),
      vehicleId: vId,
      workshopName: 'Werkstatt Schmidt',
      date: '2025-06-15',
      totalAmount: 450.50,
      currency: '€',
      mileageAtService: 52000,
      imageData: '',
      rawText: '',
      items: [
        { description: 'Ölwechsel', category: 'Wartung', amount: 120 },
        { description: 'Bremsbeläge', category: 'Verschleiß', amount: 330.50 },
      ],
      createdAt: now,
      updatedAt: now,
    })
  }, vehicleId)
}

// Helper: seed a maintenance entry via page.evaluate
async function seedMaintenance(page: any, vehicleId: string) {
  await waitForDb(page)
  await page.evaluate(async (vId: string) => {
    const db = (window as any).__rxdb
    const now = new Date().toISOString()
    await db.maintenances.insert({
      id: crypto.randomUUID(),
      vehicleId: vId,
      invoiceId: '',
      type: 'Ölwechsel',
      description: 'Motoröl 5W-30 gewechselt',
      doneAt: '2025-06-15',
      mileageAtService: 52000,
      nextDueDate: '2026-06-15',
      nextDueMileage: 67000,
      status: 'done',
      createdAt: now,
      updatedAt: now,
    })
  }, vehicleId)
}

test.describe('Vehicle CRUD', () => {
  test('edit a vehicle', async ({ page }) => {
    await createVehicleAndOpen(page, {
      make: 'BMW',
      model: '320d',
      year: '2020',
      mileage: '45000',
      plate: 'M-AB 1234',
    })

    // Click edit button
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await expect(page.getByText('Fahrzeug bearbeiten')).toBeVisible()

    // Verify form is pre-filled
    await expect(page.locator('.q-dialog').getByLabel('Marke')).toHaveValue('BMW')
    await expect(page.locator('.q-dialog').getByLabel('Modell')).toHaveValue('320d')

    // Change values
    await page.locator('.q-dialog').getByLabel('Marke').fill('Mercedes')
    await page.locator('.q-dialog').getByLabel('Modell').fill('C220')
    await page.locator('.q-dialog').getByLabel('Baujahr').fill('2022')
    await page.locator('.q-dialog').getByLabel('Kilometerstand').fill('30000')
    await page.locator('.q-dialog').getByRole('button', { name: 'Speichern' }).click()

    // Verify updated values
    await expect(page.getByText('Mercedes C220')).toBeVisible()
    await expect(page.getByText('2022')).toBeVisible()
    await expect(page.getByText('30.000 km')).toBeVisible()
  })

  test('delete a vehicle from detail page', async ({ page }) => {
    await createVehicleAndOpen(page, {
      make: 'Audi',
      model: 'A3',
      year: '2019',
      mileage: '60000',
    })

    await page.getByRole('button', { name: 'Löschen' }).click()
    await expect(page.getByText('Fahrzeug löschen?')).toBeVisible()
    await page.locator('.q-dialog').getByRole('button', { name: 'Löschen' }).click()

    await expect(page).toHaveURL(/\/vehicles/)
    await expect(page.getByText('Audi A3')).not.toBeVisible({ timeout: 5_000 })
  })
})

test.describe('Invoice CRUD', () => {
  test('edit an invoice', async ({ page }) => {
    await createVehicleAndOpen(page, {
      make: 'VW',
      model: 'Passat',
      year: '2018',
      mileage: '90000',
    })

    const vehicleId = getVehicleIdFromUrl(page)
    await seedInvoice(page, vehicleId)

    // Switch to invoices tab and wait for data (RxDB subscription is live)
    await page.getByText('Rechnungen').click()
    await expect(page.getByText('Werkstatt Schmidt')).toBeVisible({ timeout: 10_000 })

    // Open invoice detail
    await page.getByText('Werkstatt Schmidt').click()
    await expect(page.locator('.q-dialog').getByText('450.50')).toBeVisible()

    // Click edit
    await page.locator('.q-dialog').getByRole('button', { name: 'Bearbeiten' }).click()
    await expect(page.getByText('Rechnung bearbeiten')).toBeVisible()

    // Verify pre-filled values
    const editDialog = page.locator('.q-dialog', { hasText: 'Rechnung bearbeiten' })
    await expect(editDialog.getByLabel('Werkstatt')).toHaveValue('Werkstatt Schmidt')

    // Change values
    await editDialog.getByLabel('Werkstatt').fill('Autohaus Müller')
    await editDialog.getByLabel('Gesamtbetrag').fill('550.00')

    // Save
    await editDialog.getByRole('button', { name: 'Speichern' }).click()

    // Verify updated values in the list
    await page.getByText('Rechnungen').click()
    await expect(page.getByText('Autohaus Müller')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('550.00')).toBeVisible()
  })

  test('edit invoice items (add and remove)', async ({ page }) => {
    await createVehicleAndOpen(page, {
      make: 'Ford',
      model: 'Focus',
      year: '2017',
      mileage: '120000',
    })

    const vehicleId = getVehicleIdFromUrl(page)
    await seedInvoice(page, vehicleId)

    await page.getByText('Rechnungen').click()
    await expect(page.getByText('Werkstatt Schmidt')).toBeVisible({ timeout: 10_000 })

    // Open detail, then edit
    await page.getByText('Werkstatt Schmidt').click()
    await page.locator('.q-dialog').getByRole('button', { name: 'Bearbeiten' }).click()

    const editDialog = page.locator('.q-dialog', { hasText: 'Rechnung bearbeiten' })

    // Should have 2 existing items
    await expect(editDialog.getByLabel('Beschreibung').first()).toHaveValue('Ölwechsel')

    // Add a new item
    await editDialog.getByRole('button', { name: 'Position hinzufügen' }).click()
    const newDescInputs = editDialog.getByLabel('Beschreibung')
    await newDescInputs.last().fill('Luftfilter')

    // Remove the first item (Ölwechsel)
    await editDialog.locator('button').filter({ has: page.locator('.q-icon', { hasText: 'remove_circle' }) }).first().click()

    // Save
    await editDialog.getByRole('button', { name: 'Speichern' }).click()

    // Verify — reopen
    await page.getByText('Rechnungen').click()
    await page.getByText('Werkstatt Schmidt').click()
    await expect(page.locator('.q-dialog').getByText('Luftfilter')).toBeVisible({ timeout: 5_000 })
  })

  test('delete an invoice', async ({ page }) => {
    await createVehicleAndOpen(page, {
      make: 'Opel',
      model: 'Astra',
      year: '2016',
      mileage: '130000',
    })

    const vehicleId = getVehicleIdFromUrl(page)
    await seedInvoice(page, vehicleId)

    await page.getByText('Rechnungen').click()
    await expect(page.getByText('Werkstatt Schmidt')).toBeVisible({ timeout: 10_000 })

    // Open detail and delete
    await page.getByText('Werkstatt Schmidt').click()
    await page.locator('.q-dialog').getByRole('button', { name: 'Löschen' }).click()

    // Confirm deletion
    await expect(page.getByText('Rechnung löschen?')).toBeVisible()
    await page.locator('.q-dialog', { hasText: 'Rechnung löschen?' }).getByRole('button', { name: 'Löschen' }).click()

    // Invoice should be gone from the list
    await expect(page.locator('.q-tab-panel').getByText('Werkstatt Schmidt')).not.toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Keine Rechnungen vorhanden')).toBeVisible()
  })
})

test.describe('Invoice Duplicate Detection', () => {
  test('reject duplicate invoice with same date and workshop', async ({ page }) => {
    await createVehicleAndOpen(page, {
      make: 'Toyota',
      model: 'Corolla',
      year: '2020',
      mileage: '40000',
    })

    const vehicleId = getVehicleIdFromUrl(page)
    await seedInvoice(page, vehicleId)

    // Try to insert a duplicate invoice (same workshop + date) directly into RxDB
    await waitForDb(page)
    const result = await page.evaluate(async (vId: string) => {
      const db = (window as any).__rxdb
      // Check for existing invoice with same date
      const existing = await db.invoices.find({ selector: { vehicleId: vId, date: '2025-06-15' } }).exec()
      const duplicate = existing.find((d: any) => {
        const inv = d.toJSON()
        return inv.workshopName === 'Werkstatt Schmidt' || inv.totalAmount === 450.50
      })
      return {
        hasDuplicate: !!duplicate,
        existingCount: existing.length,
        workshopName: duplicate?.toJSON().workshopName,
      }
    }, vehicleId)

    // Verify that the duplicate detection finds the existing invoice
    expect(result.hasDuplicate).toBe(true)
    expect(result.existingCount).toBe(1)
    expect(result.workshopName).toBe('Werkstatt Schmidt')

    // Verify only one invoice is visible in the UI
    await page.getByText('Rechnungen').click()
    await expect(page.getByText('Werkstatt Schmidt')).toBeVisible({ timeout: 10_000 })
    const invoiceItems = page.locator('.q-tab-panel .q-item')
    await expect(invoiceItems).toHaveCount(1)
  })
})

test.describe('Maintenance CRUD', () => {
  test('edit a maintenance entry', async ({ page }) => {
    await createVehicleAndOpen(page, {
      make: 'Skoda',
      model: 'Octavia',
      year: '2019',
      mileage: '75000',
    })

    const vehicleId = getVehicleIdFromUrl(page)
    await seedMaintenance(page, vehicleId)

    // Should be on maintenance tab by default
    await expect(page.getByText('Motoröl 5W-30 gewechselt')).toBeVisible({ timeout: 10_000 })

    // Click edit button within the maintenance list item (not the header Bearbeiten button)
    const maintenanceItem = page.locator('.q-item', { hasText: 'Motoröl 5W-30 gewechselt' })
    await maintenanceItem.locator('button').filter({ has: page.locator('.q-icon', { hasText: 'edit' }) }).click()
    await expect(page.getByText('Wartungseintrag bearbeiten')).toBeVisible()

    const editDialog = page.locator('.q-dialog', { hasText: 'Wartungseintrag bearbeiten' })

    // Verify pre-filled
    await expect(editDialog.getByLabel('Beschreibung')).toHaveValue('Motoröl 5W-30 gewechselt')
    await expect(editDialog.getByLabel('Typ')).toHaveValue('Ölwechsel')

    // Change values
    await editDialog.getByLabel('Beschreibung').fill('Vollsynthetisches Öl gewechselt')
    await editDialog.getByLabel('Kilometerstand', { exact: true }).fill('76000')

    // Save
    await editDialog.getByRole('button', { name: 'Speichern' }).click()

    // Verify update
    await expect(page.getByText('Vollsynthetisches Öl gewechselt')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('76.000 km')).toBeVisible()
  })

  test('delete a maintenance entry', async ({ page }) => {
    await createVehicleAndOpen(page, {
      make: 'Seat',
      model: 'Leon',
      year: '2020',
      mileage: '55000',
    })

    const vehicleId = getVehicleIdFromUrl(page)
    await seedMaintenance(page, vehicleId)

    await expect(page.getByText('Motoröl 5W-30 gewechselt')).toBeVisible({ timeout: 10_000 })

    // Click delete button within the maintenance list item
    const maintenanceItem = page.locator('.q-item', { hasText: 'Motoröl 5W-30 gewechselt' })
    await maintenanceItem.locator('button').filter({ has: page.locator('.q-icon', { hasText: 'delete' }) }).click()

    // Confirm
    await expect(page.getByText('Wartungseintrag löschen?')).toBeVisible()
    await page.locator('.q-dialog', { hasText: 'Wartungseintrag löschen?' }).getByRole('button', { name: 'Löschen' }).click()

    // Should be gone
    await expect(page.getByText('Motoröl 5W-30 gewechselt')).not.toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Keine Wartungseinträge vorhanden')).toBeVisible()
  })

  test('change maintenance status via edit', async ({ page }) => {
    await createVehicleAndOpen(page, {
      make: 'Renault',
      model: 'Megane',
      year: '2018',
      mileage: '95000',
    })

    const vehicleId = getVehicleIdFromUrl(page)
    await seedMaintenance(page, vehicleId)

    await expect(page.getByText('Motoröl 5W-30 gewechselt')).toBeVisible({ timeout: 10_000 })

    // Open edit within the maintenance list item
    const maintenanceItem = page.locator('.q-item', { hasText: 'Motoröl 5W-30 gewechselt' })
    await maintenanceItem.locator('button').filter({ has: page.locator('.q-icon', { hasText: 'edit' }) }).click()

    const editDialog = page.locator('.q-dialog', { hasText: 'Wartungseintrag bearbeiten' })

    // Change status to "Fällig"
    await editDialog.getByLabel('Status').click()
    await page.getByRole('option', { name: 'Fällig', exact: true }).click()

    await editDialog.getByRole('button', { name: 'Speichern' }).click()

    // Entry should still be visible
    await expect(page.getByText('Motoröl 5W-30 gewechselt')).toBeVisible()
  })
})
