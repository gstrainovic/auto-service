import type { Invoice } from '../stores/invoices'
import type { Maintenance } from '../stores/maintenances'
import { describe, expect, it } from 'vitest'
import { buildDossier } from './pdf-report'

const vehicle = { make: 'VW', model: 'Caddy', licensePlate: 'SG 12345', year: 2019, vin: 'WVWZZZ', mileage: 68500 }
const invoices: Invoice[] = [
  { id: 'a', vehicleId: 'v1', date: '2025-11-02', workshopName: 'Garage Muster', totalAmount: 480, currency: 'CHF', mileageAtService: 61000, items: [{ description: 'Ölwechsel', category: 'oelwechsel', amount: 480 }], createdAt: '', updatedAt: '' },
]
const maintenances: Maintenance[] = [
  { id: '1', vehicleId: 'v1', type: 'oelwechsel', doneAt: '2025-11-02', mileageAtService: 61000, status: 'done', createdAt: '', updatedAt: '' },
]

describe('buildDossier', () => {
  it('erzeugt ein PDF mit Fahrzeug, Wartungen und Kosten', () => {
    const doc = buildDossier({ vehicle, invoices, maintenances, generatedAt: new Date('2026-09-14T10:00:00Z') })
    const bytes = doc.output('arraybuffer')
    expect(bytes.byteLength).toBeGreaterThan(1000)
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })

  it('setzt einen sprechenden Dateinamen', async () => {
    const { dossierFilename } = await import('./pdf-report')
    expect(dossierFilename(vehicle, new Date('2026-09-14T10:00:00Z'))).toBe('wartungsheft-vw-caddy-sg-12345-2026-09-14.pdf')
  })
})
