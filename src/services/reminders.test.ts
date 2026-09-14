import { describe, expect, it } from 'vitest'
import { buildReminders, reminderKey, shouldSend } from './reminders'

const iso = (d: Date) => d.toISOString().slice(0, 10)
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 86_400_000))
const now = new Date()

const users = [
  { id: 'u1', email: 'anna@example.ch' },
  { id: 'u2', email: 'ben@example.ch' },
  { id: 'u3', email: undefined },
]
const vehicles = [
  { id: 'v1', creatorId: 'u1', make: 'VW', model: 'Caddy', licensePlate: 'SG 12345', mileage: 100000 },
  { id: 'v2', creatorId: 'u1', make: 'Fiat', model: 'Ducato', licensePlate: '', mileage: 40000 },
  { id: 'v3', creatorId: 'u2', make: 'BMW', model: '320d', licensePlate: 'ZH 1', mileage: 50000 },
  { id: 'v4', creatorId: 'u3', make: 'Opel', model: 'Corsa', licensePlate: '', mileage: 50000 },
]
const maintenances = [
  // v1: Reifen vor 5 Jahren → überfällig; Ölwechsel vor 1 Monat → ok
  { vehicleId: 'v1', type: 'reifen', doneAt: daysAgo(5 * 365), mileageAtService: 90000, status: 'done' },
  { vehicleId: 'v1', type: 'oelwechsel', doneAt: daysAgo(30), mileageAtService: 99500, status: 'done' },
  // v1: geplanter Eintrag zählt nicht
  { vehicleId: 'v1', type: 'bremsen', doneAt: daysAgo(1), mileageAtService: 100000, status: 'due' },
  // v2: nichts erfasst → nur «unknown», keine Erinnerung
  // v3: Ölwechsel vor 11.5 Monaten → bald fällig
  { vehicleId: 'v3', type: 'oelwechsel', doneAt: daysAgo(350), mileageAtService: 45000, status: 'done' },
  // v4: überfällig, aber Nutzer ohne E-Mail
  { vehicleId: 'v4', type: 'reifen', doneAt: daysAgo(5 * 365), mileageAtService: 1000, status: 'done' },
]

describe('buildReminders', () => {
  it('erstellt pro Nutzer mit E-Mail eine Erinnerung mit fälligen und überfälligen Arbeiten', () => {
    const reminders = buildReminders({ users, vehicles, maintenances, settings: [], now })
    expect(reminders.map(r => r.email)).toEqual(['anna@example.ch', 'ben@example.ch'])

    const anna = reminders[0]!
    expect(anna.userId).toBe('u1')
    expect(anna.subject).toBe('Wartungsheft: 1 Arbeit fällig beim VW Caddy')
    expect(anna.text).toContain('VW Caddy · SG 12345')
    expect(anna.text).toContain('Reifenwechsel: überfällig')
    expect(anna.text).not.toContain('Ölwechsel')
    expect(anna.text).not.toContain('Bremsen')
    expect(anna.text).not.toContain('Fiat Ducato')
    expect(anna.text).toContain('https://wartungsheft.ch/dashboard')

    const ben = reminders[1]!
    expect(ben.subject).toBe('Wartungsheft: 1 Arbeit fällig beim BMW 320d')
    expect(ben.text).toContain('Ölwechsel: bald fällig')
  })

  it('überspringt Nutzer, die E-Mail-Erinnerungen abgeschaltet haben', () => {
    const reminders = buildReminders({ users, vehicles, maintenances, settings: [{ creatorId: 'u1', emailReminders: false }], now })
    expect(reminders.map(r => r.userId)).toEqual(['u2'])
  })

  it('schreibt einen stabilen Schlüssel aus Fahrzeug, Typ und Status', () => {
    const [anna] = buildReminders({ users, vehicles, maintenances, settings: [], now })
    expect(anna!.key).toBe(reminderKey([{ vehicleId: 'v1', type: 'reifen', status: 'overdue' }]))
    expect(reminderKey([{ vehicleId: 'b', type: 'x', status: 'due' }, { vehicleId: 'a', type: 'y', status: 'due' }]))
      .toBe(reminderKey([{ vehicleId: 'a', type: 'y', status: 'due' }, { vehicleId: 'b', type: 'x', status: 'due' }]))
  })
})

describe('shouldSend', () => {
  const key = 'v1:reifen:overdue'
  it('sendet beim ersten Mal und wenn sich die fälligen Arbeiten ändern', () => {
    expect(shouldSend(undefined, key, now)).toBe(true)
    expect(shouldSend({ creatorId: 'u1', lastReminderKey: 'v1:oelwechsel:due', lastReminderAt: now.toISOString() }, key, now)).toBe(true)
  })

  it('wiederholt unveränderte Erinnerungen erst nach 30 Tagen', () => {
    const recent = new Date(now.getTime() - 10 * 86_400_000).toISOString()
    const old = new Date(now.getTime() - 31 * 86_400_000).toISOString()
    expect(shouldSend({ creatorId: 'u1', lastReminderKey: key, lastReminderAt: recent }, key, now)).toBe(false)
    expect(shouldSend({ creatorId: 'u1', lastReminderKey: key, lastReminderAt: old }, key, now)).toBe(true)
  })
})
