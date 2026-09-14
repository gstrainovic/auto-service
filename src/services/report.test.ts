import type { Invoice } from '../stores/invoices'
import type { Maintenance } from '../stores/maintenances'
import { describe, expect, it } from 'vitest'
import { categoryLabel, costsByYear, fleetCostsByVehicleYear, invoicesToCsv } from './report'

function inv(over: Partial<Invoice>): Invoice {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    vehicleId: 'v1',
    date: '2026-03-10',
    createdAt: '',
    updatedAt: '',
    ...over,
  }
}

const invoices: Invoice[] = [
  inv({ id: 'a', date: '2025-11-02', workshopName: 'Garage Muster', totalAmount: 480, currency: 'CHF', mileageAtService: 61000, items: [
    { description: 'Ölwechsel', category: 'oelwechsel', amount: 180 },
    { description: 'Bremsbeläge vorne', category: 'bremsen', amount: 300 },
  ] }),
  inv({ id: 'b', date: '2026-03-10', workshopName: 'Pneu Egger', totalAmount: 890.5, currency: 'CHF', mileageAtService: 68500, items: [
    { description: 'Sommerreifen', category: 'reifen', amount: 890.5 },
  ] }),
  // Rechnung ohne Positionen zählt als «Sonstiges»; Euro-Beleg bleibt getrennt
  inv({ id: 'c', date: '2026-05-20', workshopName: 'Werkstatt Lindau', totalAmount: 120, currency: 'EUR' }),
]

describe('costsByYear', () => {
  it('summiert pro Jahr, Währung und Kategorie, neuestes Jahr zuerst', () => {
    const rows = costsByYear(invoices)
    expect(rows.map(r => [r.year, r.currency])).toEqual([[2026, 'CHF'], [2026, 'EUR'], [2025, 'CHF']])
    const chf2026 = rows[0]!
    expect(chf2026.total).toBe(890.5)
    expect(chf2026.byCategory).toEqual({ reifen: 890.5 })
    const eur2026 = rows[1]!
    expect(eur2026.total).toBe(120)
    expect(eur2026.byCategory).toEqual({ sonstiges: 120 })
    const chf2025 = rows[2]!
    expect(chf2025.total).toBe(480)
    expect(chf2025.byCategory).toEqual({ oelwechsel: 180, bremsen: 300 })
  })

  it('liefert für keine Rechnungen eine leere Liste', () => {
    expect(costsByYear([])).toEqual([])
  })
})

describe('categoryLabel', () => {
  it('übersetzt Kategorien lesbar und lässt Unbekanntes stehen', () => {
    expect(categoryLabel('oelwechsel')).toBe('Ölwechsel')
    expect(categoryLabel('tuev')).toBe('MFK / Prüfung')
    expect(categoryLabel('sonstiges')).toBe('Sonstiges')
    expect(categoryLabel('xyz')).toBe('xyz')
  })
})

describe('invoicesToCsv', () => {
  it('schreibt eine Zeile pro Position, Semikolon-getrennt, mit BOM für Excel', () => {
    const csv = invoicesToCsv(invoices, { make: 'VW', model: 'Caddy', licensePlate: 'SG 12345' })
    expect(csv.startsWith('﻿')).toBe(true)
    const lines = csv.slice(1).split('\r\n')
    expect(lines[0]).toBe('Fahrzeug;Kennzeichen;Datum;Werkstatt;Kilometerstand;Kategorie;Beschreibung;Betrag;Währung')
    expect(lines[1]).toBe('VW Caddy;SG 12345;2025-11-02;Garage Muster;61000;Ölwechsel;Ölwechsel;180.00;CHF')
    expect(lines[2]).toBe('VW Caddy;SG 12345;2025-11-02;Garage Muster;61000;Bremsen;Bremsbeläge vorne;300.00;CHF')
    expect(lines[3]).toBe('VW Caddy;SG 12345;2026-03-10;Pneu Egger;68500;Reifen;Sommerreifen;890.50;CHF')
    expect(lines[4]).toBe('VW Caddy;SG 12345;2026-05-20;Werkstatt Lindau;;Sonstiges;;120.00;EUR')
    expect(lines).toHaveLength(5)
  })

  it('schützt Semikolon und Anführungszeichen in Texten', () => {
    const csv = invoicesToCsv([inv({ workshopName: 'A; "B"', totalAmount: 1, currency: 'CHF' })], { make: 'X', model: 'Y', licensePlate: 'Z' })
    expect(csv).toContain('"A; ""B"""')
  })
})

describe('maintenance rows for the dossier', () => {
  it('sortiert Wartungen absteigend nach Datum', async () => {
    const { maintenanceRows } = await import('./report')
    const rows = maintenanceRows([
      { id: '1', vehicleId: 'v1', type: 'oelwechsel', doneAt: '2025-01-05', mileageAtService: 50000, createdAt: '', updatedAt: '' },
      { id: '2', vehicleId: 'v1', type: 'reifen', description: 'Winterreifen', doneAt: '2025-10-20', mileageAtService: 60000, createdAt: '', updatedAt: '' },
    ] as Maintenance[])
    expect(rows).toEqual([
      ['2025-10-20', 'Winterreifen', '60\'000 km'],
      ['2025-01-05', 'Ölwechsel', '50\'000 km'],
    ])
  })
})

describe('costsByYear mit Heimwährung', () => {
  const rates = new Map([['EUR|CHF|2026-05-20', 0.95]])

  it('rechnet fremde Währungen zum Kurs am Rechnungsdatum in die Heimwährung um', () => {
    const rows = costsByYear(invoices, { homeCurrency: 'CHF', rates })
    // 2026: CHF 890.50 + EUR 120 × 0.95 = 114.00 → eine Zeile CHF
    expect(rows.map(r => [r.year, r.currency, r.total])).toEqual([[2026, 'CHF', 1004.5], [2025, 'CHF', 480]])
    expect(rows[0]!.byCategory).toEqual({ reifen: 890.5, sonstiges: 114 })
    expect(rows[0]!.converted).toBe(1)
  })

  it('behandelt das Euro-Symbol aus dem Scan wie EUR', () => {
    const rows = costsByYear([inv({ id: 'e', date: '2026-05-20', totalAmount: 100, currency: '€' })], { homeCurrency: 'CHF', rates })
    expect(rows).toEqual([{ year: 2026, currency: 'CHF', total: 95, byCategory: { sonstiges: 95 }, converted: 1, unconverted: 0 }])
  })

  it('lässt Rechnungen ohne Kurs in ihrer Währung stehen', () => {
    const rows = costsByYear(invoices, { homeCurrency: 'CHF', rates: new Map() })
    expect(rows.map(r => [r.year, r.currency, r.total])).toEqual([[2026, 'CHF', 890.5], [2026, 'EUR', 120], [2025, 'CHF', 480]])
    expect(rows[1]!.unconverted).toBe(1)
  })
})

describe('fleetCostsByVehicleYear', () => {
  it('summiert pro Fahrzeug und Jahr in der Heimwährung, neuestes Jahr zuerst, Fahrzeuge alphabetisch', () => {
    const vehicles = [
      { id: 'v2', make: 'VW', model: 'Caddy', licensePlate: 'SG 2' },
      { id: 'v1', make: 'Fiat', model: 'Ducato', licensePlate: 'SG 1' },
    ]
    const all: Invoice[] = [
      ...invoices,
      inv({ id: 'd', vehicleId: 'v2', date: '2026-01-15', totalAmount: 200, currency: 'CHF' }),
    ]
    const rows = fleetCostsByVehicleYear(vehicles, all, { homeCurrency: 'CHF', rates: new Map([['EUR|CHF|2026-05-20', 0.95]]) })
    expect(rows).toEqual([
      { vehicleId: 'v1', vehicle: 'Fiat Ducato · SG 1', year: 2026, currency: 'CHF', total: 1004.5 },
      { vehicleId: 'v2', vehicle: 'VW Caddy · SG 2', year: 2026, currency: 'CHF', total: 200 },
      { vehicleId: 'v1', vehicle: 'Fiat Ducato · SG 1', year: 2025, currency: 'CHF', total: 480 },
    ])
  })
})

describe('invoicesToCsv mit Heimwährung', () => {
  it('hängt Betrag in Heimwährung und Kurs an', () => {
    const csv = invoicesToCsv(invoices, { make: 'VW', model: 'Caddy', licensePlate: 'SG 12345' }, { homeCurrency: 'CHF', rates: new Map([['EUR|CHF|2026-05-20', 0.95]]) })
    const lines = csv.slice(1).split('\r\n')
    expect(lines[0]).toBe('Fahrzeug;Kennzeichen;Datum;Werkstatt;Kilometerstand;Kategorie;Beschreibung;Betrag;Währung;Betrag CHF;Kurs')
    expect(lines[1]).toBe('VW Caddy;SG 12345;2025-11-02;Garage Muster;61000;Ölwechsel;Ölwechsel;180.00;CHF;180.00;1')
    expect(lines[4]).toBe('VW Caddy;SG 12345;2026-05-20;Werkstatt Lindau;;Sonstiges;;120.00;EUR;114.00;0.95')
  })
})
