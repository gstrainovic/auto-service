import type { Maintenance } from '../stores/maintenances'
import { describe, expect, it } from 'vitest'
import { serviceRecordSummary } from './service-record'

function m(doneAt: string, mileage: number | null, type = 'inspektion'): Maintenance {
  return { id: doneAt + type, vehicleId: 'v1', type, doneAt, mileageAtService: mileage, status: 'done', createdAt: '', updatedAt: '' }
}

describe('serviceRecordSummary', () => {
  it('fasst Zeitraum, Anzahl und Laufleistung zusammen', () => {
    const summary = serviceRecordSummary([
      m('2021-06-23', 145830),
      m('2024-01-05', 239016, 'oelwechsel'),
      m('2023-02-21', 227810),
    ], new Date('2026-09-16'))
    expect(summary).toMatchObject({
      count: 3,
      from: '2021-06-23',
      to: '2024-01-05',
      firstMileage: 145830,
      lastMileage: 239016,
      gapless: false,
    })
    // letzter Eintrag liegt über zwei Jahre zurück
    expect(summary.note).toContain('letzter Eintrag')
  })

  it('nennt eine Historie ohne grössere Lücke lückenlos', () => {
    const summary = serviceRecordSummary([
      m('2024-03-01', 100000),
      m('2025-02-01', 115000),
      m('2026-02-01', 130000),
      m('2026-08-01', 140000),
    ], new Date('2026-09-16'))
    expect(summary.gapless).toBe(true)
    expect(summary.note).toBe('')
  })

  it('kommt ohne Einträge zurecht', () => {
    const summary = serviceRecordSummary([], new Date('2026-09-16'))
    expect(summary).toMatchObject({ count: 0, gapless: false, from: '', to: '' })
  })
})
