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

  it('erzeugt eine Fuhrpark-Übersicht mit einer Seite pro Fahrzeug', async () => {
    const { buildFleetReport, fleetReportFilename } = await import('./pdf-report')
    const vehicles = [
      { id: 'v1', make: 'VW', model: 'Caddy', licensePlate: 'SG 12345', year: 2019, mileage: 68500 },
      { id: 'v2', make: 'Fiat', model: 'Ducato', licensePlate: 'SG 1', year: 2021, mileage: 40000 },
    ]
    const all: Invoice[] = [
      ...invoices,
      { id: 'b', vehicleId: 'v2', date: '2026-01-15', workshopName: 'Garage Nord', totalAmount: 200, currency: 'CHF', createdAt: '', updatedAt: '' },
    ]
    const doc = buildFleetReport({ vehicles, invoices: all, maintenances, generatedAt: new Date('2026-09-14T10:00:00Z'), currency: { homeCurrency: 'CHF', rates: new Map() } })
    const bytes = doc.output('arraybuffer')
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    // Übersichtsseite plus je eine Seite pro Fahrzeug
    expect(doc.getNumberOfPages()).toBe(3)
    expect(fleetReportFilename(new Date('2026-09-14T10:00:00Z'))).toBe('wartungsheft-alle-fahrzeuge-2026-09-14.pdf')
  })

  it('schreibt Daten als TT.MM.JJJJ und lässt Kilometerstand 0 leer', () => {
    const doc = buildDossier({
      vehicle: { ...vehicle, mileage: 0 },
      invoices: [{ ...invoices[0]!, mileageAtService: 0 }],
      maintenances,
      generatedAt: new Date(2026, 8, 14, 10, 0, 0),
    })
    const text = doc.output()
    expect(text).toContain('Stand 14.09.2026')
    expect(text).toContain('02.11.2025')
    expect(text).not.toContain('2025-11-02')
    // Textzellen stehen im PDF als «(…) Tj»; «61'000 km» der Wartung endet ebenfalls auf «0 km»
    expect(text).toContain('(61\'000 km)')
    expect(text).not.toContain('(0 km)')
  })

  it('setzt einen sprechenden Dateinamen', async () => {
    const { dossierFilename } = await import('./pdf-report')
    expect(dossierFilename(vehicle, new Date('2026-09-14T10:00:00Z'))).toBe('wartungsheft-vw-caddy-sg-12345-2026-09-14.pdf')
  })
})
