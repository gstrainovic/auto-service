import type { ParsedInvoice } from './ai'
import { describe, expect, it } from 'vitest'
import { buildBatch, draftFromParsed, fillEmptyFields, mergePdfPages, pagesLabel, scannedToFormFields } from './invoice-scan'

describe('mergePdfPages', () => {
  const inv = (over: Partial<ParsedInvoice>): ParsedInvoice => ({ workshopName: 'W', date: '2025-01-01', totalAmount: 100, currency: 'CHF', items: [], ...over })

  it('macht aus jeder Rechnungsseite eine Rechnung und lässt andere Seiten weg', () => {
    const merged = mergePdfPages([
      { page: 1, kind: 'rechnung', parsed: inv({ workshopName: 'Seestern', date: '2022-07-01' }) },
      { page: 2, kind: 'andere', parsed: inv({ workshopName: '', date: '', totalAmount: 0 }) },
      { page: 3, kind: 'rechnung', parsed: inv({ workshopName: 'A&S Service', date: '2025-03-01' }) },
    ])
    expect(merged.map(m => [m.pages, m.workshopName, m.date])).toEqual([[[1], 'Seestern', '2022-07-01'], [[3], 'A&S Service', '2025-03-01']])
  })

  it('hängt Fortsetzungsseiten an die vorherige Rechnung: Positionen dazu, fehlende Werte ergänzt', () => {
    const merged = mergePdfPages([
      { page: 8, kind: 'rechnung', parsed: inv({ workshopName: 'Lucky Car', totalAmount: 0, items: [{ description: 'Service', category: 'inspektion', amount: 900 }] }) },
      { page: 9, kind: 'fortsetzung', parsed: inv({ workshopName: 'Lucky Car', date: '', totalAmount: 1403.34, mileageAtService: 252586, items: [{ description: 'Öl', category: 'oelwechsel', amount: 100 }] }) },
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0]!.pages).toEqual([8, 9])
    expect(merged[0]!.totalAmount).toBe(1403.34)
    expect(merged[0]!.date).toBe('2025-01-01')
    expect(merged[0]!.mileageAtService).toBe(252586)
    expect(merged[0]!.items.map(i => i.description)).toEqual(['Service', 'Öl'])
  })

  it('behandelt eine Fortsetzung ohne vorherige Rechnung als eigene Rechnung', () => {
    const merged = mergePdfPages([{ page: 1, kind: 'fortsetzung', parsed: inv({}) }])
    expect(merged.map(m => m.pages)).toEqual([[1]])
  })
})

describe('pagesLabel', () => {
  it('beschreibt die Seiten einer Rechnung im PDF', () => {
    expect(pagesLabel([3])).toBe('Seite 3')
    expect(pagesLabel([1, 2])).toBe('Seite 1–2')
    expect(pagesLabel([4, 2, 3])).toBe('Seite 2–4')
    expect(pagesLabel([1, 3])).toBe('Seiten 1, 3')
    expect(pagesLabel([])).toBe('PDF')
  })
})

const parsed: ParsedInvoice = {
  workshopName: 'Lucky Car Dornbirn',
  date: '2025-04-15',
  totalAmount: 1403.34,
  currency: '€',
  mileageAtService: 252586,
  licensePlate: 'SG 218574',
  items: [
    { description: 'Motoröl wechseln', category: 'inspektion', amount: 180 },
    { description: 'Auspuff reparieren', category: 'sonstiges', amount: 1100 },
  ],
}

describe('scannedToFormFields', () => {
  it('übernimmt Werkstatt, Datum, Betrag, Währung, Kilometerstand und Positionen mit korrigierter Kategorie', () => {
    expect(scannedToFormFields(parsed)).toEqual({
      workshop: 'Lucky Car Dornbirn',
      date: '2025-04-15',
      amount: 1403.34,
      currency: 'EUR',
      mileage: 252586,
      items: [
        { description: 'Motoröl wechseln', category: 'oelwechsel', amount: 180 },
        { description: 'Auspuff reparieren', category: 'auspuff', amount: 1100 },
      ],
    })
  })

  it('fasst Positionen zusammen, die sich einen Arbeitsbetrag teilen (Nachkontrolle gegen das Total)', () => {
    const fields = scannedToFormFields({
      ...parsed,
      totalAmount: 280.4,
      currency: 'CHF',
      items: [
        { description: 'Auspuff reparieren', category: 'auspuff', amount: 195 },
        { description: 'Auto auf Ölverlust kontrollieren', category: 'sonstiges', amount: 195 },
        { description: 'Arbeit', category: 'sonstiges', amount: 195 },
        { description: 'Verbinder', category: 'sonstiges', amount: 54.6 },
      ],
    })
    expect(fields.items?.map(i => [i.description, i.amount])).toEqual([
      ['Arbeit: Auspuff reparieren, Auto auf Ölverlust kontrollieren', 195],
      ['Verbinder', 54.6],
    ])
  })

  it('lässt unbrauchbare Werte weg: kein ISO-Datum, Währung ausser CHF/EUR, Kilometer 0, Betrag 0', () => {
    const fields = scannedToFormFields({ ...parsed, date: '15.04.2025', currency: 'USD', mileageAtService: 0, totalAmount: 0, items: [] })
    expect(fields).toEqual({ workshop: 'Lucky Car Dornbirn' })
  })
})

describe('draftFromParsed', () => {
  it('liefert eine speicherbare Rechnung mit normierter Währung und korrigierten Kategorien', () => {
    expect(draftFromParsed(parsed)).toEqual({
      workshopName: 'Lucky Car Dornbirn',
      date: '2025-04-15',
      totalAmount: 1403.34,
      currency: 'EUR',
      mileageAtService: 252586,
      items: [
        { description: 'Motoröl wechseln', category: 'oelwechsel', amount: 180 },
        { description: 'Auspuff reparieren', category: 'auspuff', amount: 1100 },
      ],
    })
  })

  it('verwirft Rechnungen ohne gültiges Datum oder ohne Betrag', () => {
    expect(draftFromParsed({ ...parsed, date: '15.04.2025' })).toBeNull()
    expect(draftFromParsed({ ...parsed, totalAmount: 0 })).toBeNull()
  })

  it('lässt unbekannten Kilometerstand weg', () => {
    expect(draftFromParsed({ ...parsed, mileageAtService: 0 })?.mileageAtService).toBeUndefined()
  })
})

describe('buildBatch', () => {
  const a = { ...parsed, date: '2022-07-01', totalAmount: 1014.8, workshopName: 'Seestern - Garage Ivo Wüst' }
  const b = { ...parsed, date: '2025-05-15', totalAmount: 278.35, workshopName: 'Seestern - Garage' }

  it('markiert bereits erfasste Rechnungen (gleiches Datum, gleicher Betrag) und wählt sie ab', () => {
    const existing = [{ date: '2022-07-01', totalAmount: 1014.8, workshopName: 'Seestern Garage' }]
    const batch = buildBatch([{ parsed: a, source: 'Seite 1' }, { parsed: b, source: 'Seite 2' }], existing)
    expect(batch.map(e => [e.source, e.duplicate, e.selected])).toEqual([
      ['Seite 1', 'bereits erfasst', false],
      ['Seite 2', null, true],
    ])
  })

  it('erkennt Duplikate auch bei abweichendem Datum bis 14 Tage (Reparatur- statt Rechnungsdatum)', () => {
    const existing = [{ date: '2024-08-21', totalAmount: 958.2 }]
    const batch = buildBatch([
      { parsed: { ...parsed, date: '2024-08-23', totalAmount: 958.2 }, source: 'Seite 5' },
      { parsed: { ...parsed, date: '2024-09-30', totalAmount: 958.2 }, source: 'Seite 6' },
    ], existing)
    expect(batch.map(e => e.duplicate)).toEqual(['bereits erfasst', null])
  })

  describe('kontrollschild', () => {
    const vehicles = [
      { id: 'v1', licensePlate: 'SG 1', make: 'Fiat', model: 'Ducato' },
      { id: 'v2', licensePlate: 'SG 5', make: 'VW', model: 'Caddy' },
    ]

    it('ordnet Rechnungen dem Fahrzeug mit passendem Kontrollschild zu, sonst dem offenen Fahrzeug', () => {
      const batch = buildBatch([
        { parsed: { ...a, licensePlate: 'SG5' }, source: 'Seite 1' },
        { parsed: { ...b, licensePlate: null }, source: 'Seite 2' },
      ], [], { vehicles, currentVehicleId: 'v1' })
      expect(batch.map(e => [e.vehicleId, e.plateNote])).toEqual([
        ['v2', 'Kontrollschild SG 5: VW Caddy'],
        ['v1', null],
      ])
    })

    it('markiert ein unbekanntes Kontrollschild und lässt die Rechnung beim offenen Fahrzeug, aber abgewählt', () => {
      const [entry] = buildBatch([{ parsed: { ...a, licensePlate: 'ZH 99' }, source: 'Seite 1' }], [], { vehicles, currentVehicleId: 'v1' })
      expect([entry!.vehicleId, entry!.plateNote, entry!.selected]).toEqual(['v1', 'Kontrollschild ZH 99 gehört zu keinem Fahrzeug', false])
    })

    it('prüft Duplikate beim zugeordneten Fahrzeug', () => {
      const existing = [{ vehicleId: 'v2', date: '2022-07-01', totalAmount: 1014.8 }]
      const batch = buildBatch([
        { parsed: { ...a, licensePlate: 'SG 5' }, source: 'Seite 1' },
        { parsed: { ...a, licensePlate: 'SG 1', date: '2022-07-02' }, source: 'Seite 2' },
      ], existing, { vehicles, currentVehicleId: 'v1' })
      expect(batch.map(e => e.duplicate)).toEqual(['bereits erfasst', null])
    })
  })

  it('erkennt Doppel innerhalb des Stapels: nur das erste bleibt gewählt', () => {
    const batch = buildBatch([{ parsed: b, source: 'Seite 1' }, { parsed: b, source: 'Seite 5' }], [])
    expect(batch.map(e => [e.duplicate, e.selected])).toEqual([[null, true], ['doppelt im Beleg', false]])
  })

  it('führt unlesbare Rechnungen als Hinweis ohne Auswahl', () => {
    const batch = buildBatch([{ parsed: { ...b, date: '' }, source: 'Seite 3' }], [])
    expect(batch).toEqual([{ source: 'Seite 3', draft: null, duplicate: null, selected: false, imageBase64: undefined, vehicleId: undefined, plateNote: null }])
  })
})

describe('fillEmptyFields', () => {
  it('füllt nur leere Felder, Eingaben des Nutzers bleiben', () => {
    const current = { date: '2026-02-08', workshop: '', amount: 250, currency: 'CHF' as const, description: '', mileage: undefined }
    const merged = fillEmptyFields(current, scannedToFormFields(parsed), { currencyTouched: false })
    expect(merged.date).toBe('2026-02-08')
    expect(merged.amount).toBe(250)
    expect(merged.workshop).toBe('Lucky Car Dornbirn')
    expect(merged.mileage).toBe(252586)
    expect(merged.items).toHaveLength(2)
  })

  it('übernimmt die Währung des Belegs, solange der Nutzer sie nicht selbst gewählt hat', () => {
    const current = { date: '', currency: 'CHF' as const }
    expect(fillEmptyFields(current, { currency: 'EUR' }, { currencyTouched: false }).currency).toBe('EUR')
    expect(fillEmptyFields(current, { currency: 'EUR' }, { currencyTouched: true }).currency).toBe('CHF')
  })
})
