import { describe, expect, it } from 'vitest'
import { getMaintenanceSchedule } from './maintenance-schedule'
import { mergeIntervals, rowsToSchedule, scheduleRows, serviceBookEntries } from './service-book'

describe('scheduleRows', () => {
  it('startet ohne eigenen Plan mit den allgemeinen Intervallen', () => {
    const rows = scheduleRows(undefined)
    expect(rows.map(r => r.type)).toEqual(getMaintenanceSchedule().map(s => s.type))
    expect(new Set(rows.map(r => r.key)).size).toBe(rows.length)
  })

  it('übernimmt einen vorhandenen eigenen Plan', () => {
    const rows = scheduleRows([{ type: 'oelwechsel', label: 'Motoröl + Filter', intervalKm: 20000, intervalMonths: 24 }])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ type: 'oelwechsel', label: 'Motoröl + Filter', intervalKm: 20000, intervalMonths: 24 })
  })
})

describe('mergeIntervals', () => {
  it('überschreibt die Zeile gleicher Art und hängt neue Arten an', () => {
    const rows = scheduleRows(undefined)
    const { rows: merged, changed } = mergeIntervals(rows, [
      { type: 'oelwechsel', intervalKm: 30000, intervalMonths: 24 },
      { type: 'kuehlung', label: 'Kühlmittel', intervalKm: 0, intervalMonths: 48 },
    ])
    expect(changed).toBe(2)
    expect(merged.find(r => r.type === 'oelwechsel')).toMatchObject({ intervalKm: 30000, intervalMonths: 24, label: 'Ölwechsel' })
    expect(merged[merged.length - 1]).toMatchObject({ type: 'kuehlung', label: 'Kühlmittel', intervalMonths: 48 })
    expect(merged).toHaveLength(rows.length + 1)
  })

  it('ignoriert Intervalle ohne Werte, unbekannte Arten und unmögliche Abstände', () => {
    const rows = scheduleRows(undefined)
    const { rows: merged, changed } = mergeIntervals(rows, [
      { type: 'oelwechsel', intervalKm: 0, intervalMonths: 0 },
      { type: 'Motorwäsche', intervalKm: 10000, intervalMonths: 12 },
      // «2, 6, 10 … Jahre» als 144 Monate gelesen
      { type: 'inspektion', intervalKm: 0, intervalMonths: 144 },
      { type: 'reifen', intervalKm: 500000, intervalMonths: 48 },
    ])
    expect(changed).toBe(0)
    expect(merged).toEqual(rows)
  })

  it('verwirft ein Intervall, das für viele Arten identisch gemeldet wird (Checkliste einer Wartung)', () => {
    const rows = scheduleRows(undefined)
    const spread = ['inspektion', 'oelwechsel', 'bremsen', 'reifen', 'zahnriemen', 'kuehlung']
      .map(type => ({ type, intervalKm: 30000, intervalMonths: 24 }))
    const { rows: merged, changed, ignored } = mergeIntervals(rows, [...spread, { type: 'bremsflüssigkeit', intervalKm: 0, intervalMonths: 36 }])
    expect(ignored).toBe(6)
    expect(changed).toBe(1)
    expect(merged.find(r => r.type === 'bremsflüssigkeit')).toMatchObject({ intervalMonths: 36 })
    expect(merged.find(r => r.type === 'zahnriemen')).toMatchObject({ intervalKm: 120000 })
  })

  it('ändert nichts, wenn die Werte schon stimmen', () => {
    const rows = scheduleRows(undefined)
    const oil = rows.find(r => r.type === 'oelwechsel')!
    expect(mergeIntervals(rows, [{ type: 'oelwechsel', intervalKm: oil.intervalKm, intervalMonths: oil.intervalMonths }]).changed).toBe(0)
  })
})

describe('rowsToSchedule', () => {
  it('lässt Zeilen ohne Intervall weg und ergänzt leere Bezeichnungen', () => {
    const schedule = rowsToSchedule([
      { key: 'a', type: 'oelwechsel', label: ' ', intervalKm: 15000, intervalMonths: 12 },
      { key: 'b', type: 'reifen', label: 'Reifen', intervalKm: 0, intervalMonths: 0 },
      { key: 'c', type: 'tuev', label: 'MFK', intervalKm: null as unknown as number, intervalMonths: 36 },
    ])
    expect(schedule).toEqual([
      { type: 'oelwechsel', label: 'Ölwechsel', intervalKm: 15000, intervalMonths: 12 },
      { type: 'tuev', label: 'MFK', intervalKm: 0, intervalMonths: 36 },
    ])
  })
})

describe('serviceBookEntries', () => {
  const book = [
    {
      date: '2024-03-15',
      mileage: 120000,
      workshopName: 'Garage Muster',
      items: [
        { description: 'Motoröl gewechselt', category: 'oelwechsel' as const },
        { description: 'Ölfilter ersetzt', category: 'oelwechsel' as const },
        { description: 'Service nach Herstellervorgabe', category: 'inspektion' as const },
      ],
    },
    { date: '15.03.2022', mileage: 90000, items: [{ description: 'Bremsflüssigkeit', category: 'bremsflüssigkeit' as const }] },
    { date: '2022-02-01', mileage: 0, items: [{ description: 'Zahnriemen', category: 'zahnriemen' as const }] },
  ]

  it('macht pro Datum und Art einen Eintrag und fasst Beschreibungen zusammen', () => {
    const entries = serviceBookEntries(book, [])
    expect(entries.map(e => [e.doneAt, e.type])).toEqual([
      ['2024-03-15', 'oelwechsel'],
      ['2024-03-15', 'inspektion'],
      ['2022-02-01', 'zahnriemen'],
    ])
    expect(entries[0]).toMatchObject({ description: 'Motoröl gewechselt, Ölfilter ersetzt', mileage: 120000, workshop: 'Garage Muster', selected: true, duplicate: false })
    // 0 km heisst unbekannt
    expect(entries[2]!.mileage).toBeNull()
  })

  it('lässt Einträge ohne lesbares Datum weg', () => {
    expect(serviceBookEntries(book, []).some(e => e.type === 'bremsflüssigkeit')).toBe(false)
  })

  it('markiert Stempel, deren Kilometer nicht zur Datumsfolge passen, als zweifelhaft und wählt sie ab', () => {
    // echtes Porsche-Serviceheft: Handschrift falsch gelesen, 30'379 km nach 206'108 km
    const pages = [
      { date: '2011-06-23', mileage: 145830, items: [{ description: 'Kleine Wartung', category: 'inspektion' }] },
      { date: '2012-10-08', mileage: 206108, items: [{ description: 'Große Wartung', category: 'inspektion' }] },
      { date: '2012-11-03', mileage: 30379, items: [{ description: 'Kleine Wartung', category: 'inspektion' }] },
      { date: '2023-07-18', mileage: 231459, items: [{ description: 'Kleine Wartung', category: 'inspektion' }] },
      { date: '2022-06-03', mileage: null, items: [{ description: 'Motorölwechsel', category: 'oelwechsel' }] },
    ]
    const entries = serviceBookEntries(pages, [])
    const byDate = Object.fromEntries(entries.map(e => [e.doneAt, e]))
    expect(byDate['2012-11-03']).toMatchObject({ doubtful: true, selected: false })
    expect(byDate['2011-06-23']).toMatchObject({ doubtful: false, selected: true })
    expect(byDate['2012-10-08']).toMatchObject({ doubtful: false, selected: true })
    expect(byDate['2023-07-18']).toMatchObject({ doubtful: false, selected: true })
    // ohne Kilometer nichts zu vergleichen
    expect(byDate['2022-06-03']).toMatchObject({ doubtful: false, selected: true })
    // Liste nach Datum, neueste zuerst
    expect(entries.map(e => e.doneAt)).toEqual(['2023-07-18', '2022-06-03', '2012-11-03', '2012-10-08', '2011-06-23'])
  })

  it('markiert bereits erfasste Arbeiten (gleiche Art, höchstens 14 Tage auseinander) und wählt sie ab', () => {
    const entries = serviceBookEntries(book, [
      { type: 'oelwechsel', doneAt: '2024-03-20', status: 'done' },
      { type: 'inspektion', doneAt: '2024-03-15', status: 'due' },
      { type: 'zahnriemen', doneAt: '2022-03-01', status: 'done' },
    ])
    expect(entries.map(e => e.duplicate)).toEqual([true, false, false])
    expect(entries.map(e => e.selected)).toEqual([false, true, true])
  })
})
