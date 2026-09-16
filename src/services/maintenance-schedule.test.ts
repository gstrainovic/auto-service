import type { DueResult } from './maintenance-schedule'
import { describe, expect, it } from 'vitest'
import { addMonths, checkDueMaintenances, dueDescription, fleetDueList, getMaintenanceSchedule, vehicleDueStatus } from './maintenance-schedule'

const schedule = getMaintenanceSchedule()

describe('fleetDueList', () => {
  const vehicles = [
    { id: 'v1', make: 'Fiat', model: 'Ducato', licensePlate: 'SG 1' },
    { id: 'v2', make: 'VW', model: 'Caddy', licensePlate: '' },
  ]
  const item = (over: Partial<DueResult>): DueResult => ({ key: 'oelwechsel|Ölwechsel', type: 'oelwechsel', label: 'Ölwechsel', status: 'done', ...over })

  it('listet über alle Fahrzeuge nur Fälliges, überfällig zuerst, dann nach Termin', () => {
    const list = fleetDueList(vehicles, {
      v1: [
        item({ type: 'bremsen', label: 'Bremsen', status: 'due', nextDueDate: '2026-10-01' }),
        item({ type: 'tuev', label: 'MFK', status: 'unknown' }),
        item({ type: 'reifen', label: 'Reifen', status: 'done', nextDueDate: '2027-01-01' }),
      ],
      v2: [
        item({ status: 'overdue', nextDueDate: '2026-05-01' }),
        item({ type: 'inspektion', label: 'Inspektion', status: 'due', nextDueDate: '2026-09-20' }),
      ],
    })
    expect(list.map(e => [e.vehicleName, e.item.label])).toEqual([
      ['VW Caddy', 'Ölwechsel'],
      ['VW Caddy', 'Inspektion'],
      ['Fiat Ducato · SG 1', 'Bremsen'],
    ])
  })
})

describe('dueDescription', () => {
  it('beschreibt Termin und Kilometer je nach Status', () => {
    expect(dueDescription({ key: 'x', type: 'x', label: 'x', status: 'overdue', nextDueDate: '2026-04-15', nextDueMileage: 267586 })).toBe('fällig seit 15.04.2026 oder 267\'586 km')
    expect(dueDescription({ key: 'x', type: 'x', label: 'x', status: 'due', nextDueDate: '2026-10-01' })).toBe('fällig am 01.10.2026')
    expect(dueDescription({ key: 'x', type: 'x', label: 'x', status: 'done', nextDueDate: '2027-10-01', nextDueMileage: 90000 })).toBe('nächste am 01.10.2027 oder bei 90\'000 km')
    expect(dueDescription({ key: 'x', type: 'x', label: 'x', status: 'unknown' })).toBe('noch nie erfasst')
  })
})

describe('vehicleDueStatus', () => {
  const s = (status: DueResult['status']): DueResult => ({ key: 'x', type: 'x', label: 'x', status })
  it('fasst die Fälligkeiten eines Fahrzeugs zusammen; ohne jeden Eintrag nicht «OK»', () => {
    expect(vehicleDueStatus([s('done'), s('overdue'), s('due')])).toBe('overdue')
    expect(vehicleDueStatus([s('done'), s('due'), s('unknown')])).toBe('due')
    expect(vehicleDueStatus([s('done'), s('unknown')])).toBe('ok')
    expect(vehicleDueStatus([s('unknown'), s('unknown')])).toBe('unknown')
    expect(vehicleDueStatus([])).toBe('unknown')
  })
})

describe('addMonths', () => {
  it('rechnet kalendarisch und klammert den Tag ans Monatsende', () => {
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
    expect(addMonths('2023-01-31', 1)).toBe('2023-02-28')
    expect(addMonths('2024-01-15', 6)).toBe('2024-07-15')
    expect(addMonths('2024-08-31', 6)).toBe('2025-02-28')
    expect(addMonths('2024-11-30', 3)).toBe('2025-02-28')
  })

  it('liefert das Fälligkeitsdatum als ISO-Tag ohne Zeitzonenverschiebung', () => {
    const result = checkDueMaintenances({
      currentMileage: 1,
      schedule,
      lastMaintenances: [{ type: 'oelwechsel', doneAt: '2024-01-31', mileageAtService: 0 }],
    })
    expect(result.find(r => r.type === 'oelwechsel')!.nextDueDate).toBe('2025-01-31')
  })
})

describe('dueDescription mit geplantem Termin', () => {
  it('nennt den vereinbarten Termin statt nur der Fälligkeit', () => {
    expect(dueDescription({ key: 'reifen', type: 'reifen', label: 'Reifenwechsel', status: 'overdue', nextDueDate: '2026-04-15', plannedAt: '2026-10-02' }))
      .toBe('fällig seit 15.04.2026, Termin am 02.10.2026')
  })
})

describe('checkDueMaintenances', () => {
  it('fasst Einträge ausserhalb des Intervallplans pro Typ zusammen und zeigt den neuesten', () => {
    const result = checkDueMaintenances({
      currentMileage: 231457,
      schedule,
      lastMaintenances: [
        { type: 'fahrwerk', doneAt: '2022-07-01', mileageAtService: 214583 },
        { type: 'fahrwerk', doneAt: '2024-08-21', mileageAtService: 244457 },
        { type: 'fahrwerk', doneAt: '2022-07-01', mileageAtService: 214583 },
        { type: 'sonstiges', doneAt: '2023-02-21', mileageAtService: 227810 },
        { type: 'sonstiges', doneAt: '2022-07-01', mileageAtService: 214583 },
      ],
    })
    const extras = result.filter(r => !schedule.some(s => s.type === r.type))
    expect(extras.map(r => r.type)).toEqual(['fahrwerk', 'sonstiges'])
    expect(extras[0]!.lastDoneAt).toBe('2024-08-21')
    expect(extras[1]!.lastDoneAt).toBe('2023-02-21')
  })

  it('nimmt für Intervall-Typen den neuesten Eintrag, nicht den ersten', () => {
    const result = checkDueMaintenances({
      currentMileage: 100000,
      schedule,
      lastMaintenances: [
        { type: 'oelwechsel', doneAt: '2020-01-01', mileageAtService: 50000 },
        { type: 'oelwechsel', doneAt: '2026-08-01', mileageAtService: 99000 },
      ],
    })
    const oil = result.find(r => r.type === 'oelwechsel')!
    expect(oil.lastDoneAt).toBe('2026-08-01')
    expect(oil.status).toBe('done')
  })

  it('beschriftet alle Kategorien mit dem gemeinsamen Label, keine rohen Schlüssel', () => {
    const result = checkDueMaintenances({
      currentMileage: 1,
      schedule,
      lastMaintenances: [
        { type: 'fahrwerk', doneAt: '2024-01-05', mileageAtService: 239016 },
        { type: 'kuehlung', doneAt: '2024-01-05', mileageAtService: 239016 },
        { type: 'auspuff', doneAt: '2024-01-05', mileageAtService: 239016 },
        { type: 'autoglas', doneAt: '2024-01-05', mileageAtService: 239016 },
      ],
    })
    const labels = Object.fromEntries(result.map(r => [r.type, r.label]))
    expect(labels).toMatchObject({ fahrwerk: 'Fahrwerk', kuehlung: 'Kühlung', auspuff: 'Auspuff', autoglas: 'Autoglas', tuev: 'MFK / Prüfung' })
  })

  it('merkt sich einen geplanten Termin in der Zukunft und lässt vergangene Planungen weg', () => {
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    const inDays = (n: number) => iso(new Date(Date.now() + n * 86_400_000))
    const result = checkDueMaintenances({
      currentMileage: 100000,
      schedule,
      lastMaintenances: [{ type: 'reifen', doneAt: '2019-01-01', mileageAtService: 50000 }],
      plannedMaintenances: [
        { type: 'reifen', doneAt: inDays(10) },
        // ältere Planung zählt nicht mehr, der Termin ist vorbei
        { type: 'bremsen', doneAt: inDays(-5) },
        // von zwei Terminen zählt der nächste
        { type: 'tuev', doneAt: inDays(40) },
        { type: 'tuev', doneAt: inDays(20) },
      ],
    })
    const byType = Object.fromEntries(result.map(r => [r.type, r]))
    expect(byType.reifen).toMatchObject({ status: 'overdue', plannedAt: inDays(10) })
    expect(byType.bremsen!.plannedAt).toBeUndefined()
    expect(byType.tuev!.plannedAt).toBe(inDays(20))
  })

  it('hält zwei Plan-Einträge derselben Art auseinander (Getriebeöl und Differentialöl)', () => {
    const custom = [
      { type: 'sonstiges' as const, label: 'Getriebeöl', intervalKm: 60000, intervalMonths: 72 },
      { type: 'sonstiges' as const, label: 'Differentialöl', intervalKm: 120000, intervalMonths: 120 },
    ]
    const result = checkDueMaintenances({
      currentMileage: 200000,
      schedule: getMaintenanceSchedule(custom),
      lastMaintenances: [
        { type: 'sonstiges', description: 'Getriebeöl gewechselt', doneAt: '2024-01-05', mileageAtService: 150000 },
        { type: 'sonstiges', description: 'Differentialöl gewechselt', doneAt: '2020-01-05', mileageAtService: 100000 },
      ],
    })
    const byLabel = Object.fromEntries(result.map(r => [r.label, r]))
    expect(byLabel.Getriebeöl).toMatchObject({ lastDoneAt: '2024-01-05', lastMileage: 150000, nextDueMileage: 210000 })
    expect(byLabel.Differentialöl).toMatchObject({ lastDoneAt: '2020-01-05', lastMileage: 100000, nextDueMileage: 220000 })
    // eigener Schlüssel je Plan-Eintrag, nicht nur die Kategorie
    expect(new Set(result.map(r => r.key)).size).toBe(result.length)
  })

  it('meldet Intervalle ohne jeden Eintrag als «unknown», nicht als fällig', () => {
    const result = checkDueMaintenances({ currentMileage: 50000, schedule, lastMaintenances: [] })
    expect(result.every(r => r.status === 'unknown')).toBe(true)
    expect(result.find(r => r.type === 'zahnriemen')!.lastDoneAt).toBeUndefined()
  })

  it('unterscheidet erledigt, bald fällig und überfällig', () => {
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    const daysAgo = (n: number) => iso(new Date(Date.now() - n * 86_400_000))
    const result = checkDueMaintenances({
      currentMileage: 100000,
      schedule,
      lastMaintenances: [
        // Ölwechsel: 15'000 km / 12 Monate. Vor 1 Monat bei 99'500 km → weit weg → done
        { type: 'oelwechsel', doneAt: daysAgo(30), mileageAtService: 99500 },
        // Inspektion: 30'000 km / 24 Monate. Vor 2 Monaten, nächste bei 100'800 km, also in 800 km → due (bald)
        { type: 'inspektion', doneAt: daysAgo(60), mileageAtService: 70800 },
        // Bremsen: 30'000 km / 24 Monate. Vor 23.5 Monaten → Termin in ~2 Wochen → due (bald)
        { type: 'bremsen', doneAt: daysAgo(700), mileageAtService: 99000 },
        // Reifen: 40'000 km / 48 Monate. Vor 5 Jahren → overdue
        { type: 'reifen', doneAt: daysAgo(5 * 365), mileageAtService: 90000 },
      ],
    })
    const byType = Object.fromEntries(result.map(r => [r.type, r.status]))
    expect(byType).toMatchObject({ oelwechsel: 'done', inspektion: 'due', bremsen: 'due', reifen: 'overdue' })
  })

  it('lässt den Kilometerstand weg, wenn er fehlt oder 0 ist', () => {
    const result = checkDueMaintenances({
      currentMileage: 1,
      schedule,
      lastMaintenances: [
        { type: 'autoglas', doneAt: '2025-04-05', mileageAtService: 0 },
        { type: 'oelwechsel', doneAt: '2025-04-05', mileageAtService: undefined as unknown as number },
      ],
    })
    expect(result.find(r => r.type === 'autoglas')!.lastMileage).toBeUndefined()
    const oil = result.find(r => r.type === 'oelwechsel')!
    expect(oil.lastMileage).toBeUndefined()
    // ohne Kilometerstand zählt nur die Zeit
    expect(oil.nextDueMileage).toBeUndefined()
  })
})
