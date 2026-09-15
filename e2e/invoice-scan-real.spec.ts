import type { Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { clearInstantDB, expect, test } from './fixtures/test-fixtures'

// Beleg-Scan im Formular mit ECHTEM Mistral über den lokalen AI-Proxy und echten Fotos aus tmp/ (gitignored).
// Kostet OCR-Seiten, darum nur im Projekt ai-soft: npx playwright test e2e/invoice-scan-real.spec.ts --project=ai-soft
// Geprüft wird der Endzustand der Felder, nicht der genaue Wortlaut der KI.

const TMP = path.join(import.meta.dirname, '..', 'tmp')
const photos = fs.existsSync(path.join(TMP, 'test-images'))
  ? fs.readdirSync(path.join(TMP, 'test-images')).filter(f => f.endsWith('.jpg')).sort().slice(0, 3)
  : []
const pdf = path.join(TMP, 'test-images-9pages.pdf')

async function openInvoiceForm(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(() => !!(window as any).__instantdb, { timeout: 30_000 })
  const vehicleId = await page.evaluate(async () => {
    const { db, tx, id: genId } = (window as any).__instantdb
    const v = genId()
    const now = new Date().toISOString()
    await db.transact([tx.vehicles[v].update({ make: 'Porsche', model: 'Cayenne', year: 2008, mileage: 231457, licensePlate: 'SG 218574', createdAt: now, updatedAt: now })])
    return v as string
  })
  await page.goto(`/vehicles/${vehicleId}`)
  await page.getByRole('tab', { name: 'Rechnungen' }).click()
  await page.getByRole('button', { name: /rechnung.*hinzufügen/i }).click()
}

async function readForm(page: Page) {
  const dialog = page.locator('[data-pc-name="dialog"]')
  return {
    message: (await dialog.locator('.scan-message').textContent())?.trim(),
    workshop: await dialog.locator('#invoice-workshop').inputValue(),
    date: await dialog.locator('#invoice-date').inputValue(),
    amount: await dialog.locator('#invoice-amount input').inputValue(),
    currency: (await dialog.getByRole('button', { pressed: true }).first().textContent())?.trim(),
    mileage: await dialog.locator('#invoice-mileage input').inputValue(),
    items: await dialog.locator('.scan-item').allTextContents(),
    preview: await dialog.locator('.image-preview img').evaluate((img: HTMLImageElement) => `${img.naturalWidth}x${img.naturalHeight}`).catch(() => '-'),
  }
}

test.describe('Beleg-Scan mit echtem Mistral @soft', () => {
  test.setTimeout(180_000)

  test.beforeEach(async ({ page }) => {
    await clearInstantDB(page)
  })

  for (const photo of photos) {
    test(`Foto ${photo} füllt Datum, Betrag und Positionen @soft`, async ({ page }) => {
      await openInvoiceForm(page)
      const dialog = page.locator('[data-pc-name="dialog"]')
      await dialog.locator('input[type="file"]').setInputFiles(path.join(TMP, 'test-images', photo))
      await expect(dialog.locator('.scan-message')).toBeVisible({ timeout: 150_000 })
      const form = await readForm(page)
      // eslint-disable-next-line no-console
      console.log(`[real-scan] ${photo}`, JSON.stringify(form))
      // Kilometerstand im Schweizer Format, falls erkannt
      if (form.mileage)
        expect(form.mileage).toMatch(/^\d{1,3}(’\d{3})* km$/)
      expect(form.message).toContain('Felder aus dem Beleg ausgefüllt')
      expect(form.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(form.amount).not.toBe('')
      expect(form.items.length).toBeGreaterThan(0)
      const [w, h] = form.preview.split('x').map(Number)
      expect(h).toBeGreaterThan(w!)
    })
  }

  test('PDF mit mehreren Seiten füllt Felder und verweist auf den Chat @soft', async ({ page }) => {
    test.skip(!fs.existsSync(pdf), 'tmp/test-images-9pages.pdf fehlt')
    // 22 MB, 9 Seiten: OCR und Auswertung dauern rund drei Minuten
    test.setTimeout(360_000)
    await openInvoiceForm(page)
    const dialog = page.locator('[data-pc-name="dialog"]')
    await dialog.locator('input[type="file"]').setInputFiles(pdf)
    await expect(dialog.locator('.scan-message')).toBeVisible({ timeout: 330_000 })
    const form = await readForm(page)
    // eslint-disable-next-line no-console
    console.log('[real-scan] pdf', JSON.stringify(form))
    expect(form.message).toContain('Felder aus dem Beleg ausgefüllt')
    expect(form.message).toContain('Seiten')
    expect(form.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
