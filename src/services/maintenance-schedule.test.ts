import { describe, expect, it } from 'vitest'
import { checkDueMaintenances, getMaintenanceSchedule } from './maintenance-schedule'

const schedule = getMaintenanceSchedule()

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
