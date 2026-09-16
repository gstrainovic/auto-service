import type { Invoice } from '../stores/invoices'
import { describe, expect, it } from 'vitest'
import { invoiceYears, yearExportFilename, yearExportFiles } from './year-export'

const vehicles = [
  { id: 'v1', make: 'VW', model: 'Caddy', licensePlate: 'SG 12345' },
  { id: 'v2', make: 'Fiat', model: 'Ducato', licensePlate: '' },
]
const png = 'iVBORw0KGgo='
const jpg = '/9j/4AAQSkZJRg=='
const invoices = [
  { id: 'a', vehicleId: 'v1', date: '2026-03-10', workshopName: 'Garage Müster AG', totalAmount: 480, currency: 'CHF', items: [{ description: 'Ölwechsel', category: 'oelwechsel', amount: 480 }], imageData: jpg, createdAt: '', updatedAt: '' },
  { id: 'b', vehicleId: 'v2', date: '2026-07-01', workshopName: 'Pneu Egger', totalAmount: 250, currency: 'CHF', items: [], imageData: png, createdAt: '', updatedAt: '' },
  // anderes Jahr und ohne Beleg
  { id: 'c', vehicleId: 'v1', date: '2025-11-02', workshopName: 'Alt', totalAmount: 100, currency: 'CHF', items: [], createdAt: '', updatedAt: '' },
  { id: 'd', vehicleId: 'v1', date: '2026-09-09', workshopName: 'Ohne Beleg', totalAmount: 60, currency: 'CHF', items: [], createdAt: '', updatedAt: '' },
] as unknown as Invoice[]

const currency = { homeCurrency: 'CHF', rates: new Map() }

describe('invoiceYears', () => {
  it('listet die Jahre mit Rechnungen, neuestes zuerst', () => {
    expect(invoiceYears(invoices)).toEqual([2026, 2025])
    expect(invoiceYears([])).toEqual([])
  })
})

describe('yearExportFiles', () => {
  const files = yearExportFiles({ year: 2026, vehicles, invoices, currency })

  it('legt die CSV des Jahres an, ohne Rechnungen anderer Jahre', () => {
    const csv = files.find(f => f.name.endsWith('.csv'))!
    const text = new TextDecoder().decode(csv.data)
    expect(csv.name).toBe('kosten-2026.csv')
    expect(text).toContain('2026-03-10;Garage Müster AG')
    expect(text).toContain('2026-09-09;Ohne Beleg')
    expect(text).not.toContain('2025-11-02')
  })

  it('legt pro Beleg ein Bild ab, mit sprechendem Namen und richtiger Endung', () => {
    const images = files.filter(f => f.name.startsWith('belege/'))
    expect(images.map(f => f.name)).toEqual([
      'belege/2026-03-10-vw-caddy-garage-muester-ag.jpg',
      'belege/2026-07-01-fiat-ducato-pneu-egger.webp',
    ])
    expect(images[0]!.data.length).toBeGreaterThan(5)
  })

  it('liefert nichts, wenn das Jahr keine Rechnungen hat', () => {
    expect(yearExportFiles({ year: 2024, vehicles, invoices, currency })).toEqual([])
  })
})

describe('yearExportFilename', () => {
  it('nennt Jahr und Datum', () => {
    expect(yearExportFilename(2026, new Date('2026-09-16T08:00:00Z'))).toBe('wartungsheft-jahresabschluss-2026.zip')
  })
})
