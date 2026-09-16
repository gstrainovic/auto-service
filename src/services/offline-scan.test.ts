import type { Invoice } from '../stores/invoices'
import { describe, expect, it } from 'vitest'
import { mergeScanIntoInvoice, pendingScans } from './offline-scan'

const base: Invoice = { id: 'a', vehicleId: 'v1', date: '2026-09-16', createdAt: '', updatedAt: '' }

const parsed = {
  workshopName: 'Garage Kunz',
  date: '2026-03-10',
  totalAmount: 480,
  currency: 'CHF',
  mileageAtService: 61000,
  items: [{ description: 'Ölwechsel', category: 'oelwechsel' as const, amount: 480 }],
}

describe('pendingScans', () => {
  it('nimmt nur Belege mit Bild, die auf den Scan warten', () => {
    const invoices: Invoice[] = [
      { ...base, id: 'warten', imageData: 'BASE64', scanPending: true },
      // ohne Bild gibt es nichts zu scannen
      { ...base, id: 'ohne-bild', scanPending: true },
      { ...base, id: 'fertig', imageData: 'BASE64' },
    ]
    expect(pendingScans(invoices).map(i => i.id)).toEqual(['warten'])
  })
})

describe('mergeScanIntoInvoice', () => {
  it('liefert nur Änderungen für leere Felder und nimmt die Markierung weg', () => {
    // Werkstatt und Betrag stehen von Hand drin, das Datum fehlt
    const invoice: Invoice = { ...base, date: '', imageData: 'BASE64', scanPending: true, workshopName: 'Von Hand', totalAmount: 500 }
    expect(mergeScanIntoInvoice(invoice, parsed)).toEqual({
      date: '2026-03-10',
      currency: 'CHF',
      mileageAtService: 61000,
      items: [{ description: 'Ölwechsel', category: 'oelwechsel', amount: 480 }],
      scanPending: false,
    })
  })

  it('lässt vorhandene Positionen in Ruhe', () => {
    const invoice: Invoice = { ...base, imageData: 'BASE64', scanPending: true, items: [{ description: 'Eigene Position', category: 'sonstiges', amount: 10 }] }
    expect(mergeScanIntoInvoice(invoice, parsed).items).toBeUndefined()
  })

  it('nimmt die Markierung auch weg, wenn der Scan nichts hergibt', () => {
    const invoice: Invoice = { ...base, imageData: 'BASE64', scanPending: true, workshopName: 'X', totalAmount: 1, currency: 'CHF', mileageAtService: 2, items: [] }
    expect(mergeScanIntoInvoice(invoice, { workshopName: '', date: '', totalAmount: 0, currency: '', items: [] } as any)).toEqual({ scanPending: false })
  })
})
