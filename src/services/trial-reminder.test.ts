import { describe, expect, it } from 'vitest'
import { buildTrialReminders, NOTICE_DAYS_LEFT, trialNotice } from './trial-reminder'

const TRIAL_DAYS = 30
const users = [{ id: 'u1', email: 'a@b.ch' }]

function subAt(daysLeft: number, now: Date, status = 'trial') {
  const startedAt = new Date(now.getTime() - (TRIAL_DAYS - daysLeft) * 86_400_000).toISOString()
  return { userId: 'u1', status, trialStartedAt: startedAt }
}

describe('trialNotice', () => {
  it('schweigt, solange die Testzeit lange läuft', () => {
    expect(trialNotice({ active: true, daysLeft: 8, endsAt: '2026-10-01' })).toBeNull()
    expect(trialNotice(null)).toBeNull()
  })

  it('warnt in der letzten Woche mit Restzeit und Datum', () => {
    expect(trialNotice({ active: true, daysLeft: NOTICE_DAYS_LEFT, endsAt: '2026-10-01' }))
      .toBe('Testzeit läuft noch 7 Tage, bis 01.10.2026. Danach brauchen Scannen und Chat ein Abo.')
    expect(trialNotice({ active: true, daysLeft: 1, endsAt: '2026-10-01' })).toContain('noch 1 Tag,')
  })

  it('nennt nach Ablauf, was bleibt', () => {
    expect(trialNotice({ active: false, daysLeft: 0, endsAt: '2026-09-01' })).toContain('Testzeit vorbei')
  })
})

describe('buildTrialReminders', () => {
  const now = new Date('2026-09-20T06:00:00.000Z')

  it('mailt genau sieben Tage vor Schluss', () => {
    const [mail] = buildTrialReminders({ users, subscriptions: [subAt(7, now)], settings: [], now, trialDays: TRIAL_DAYS })
    expect(mail!.subject).toContain('Testzeit endet am 27.09.2026')
    expect(mail!.text).toContain('/settings')
    expect(mail!.email).toBe('a@b.ch')
  })

  it('nicht früher und nicht später', () => {
    for (const daysLeft of [8, 6, 1, 0]) {
      expect(buildTrialReminders({ users, subscriptions: [subAt(daysLeft, now)], settings: [], now, trialDays: TRIAL_DAYS })).toEqual([])
    }
  })

  it('nicht an Kunden mit Abo', () => {
    expect(buildTrialReminders({ users, subscriptions: [subAt(7, now, 'active')], settings: [], now, trialDays: TRIAL_DAYS })).toEqual([])
  })

  it('nur einmal pro Testzeit', () => {
    const subscriptions = [subAt(7, now)]
    const [first] = buildTrialReminders({ users, subscriptions, settings: [], now, trialDays: TRIAL_DAYS })
    const settings = [{ creatorId: 'u1', lastTrialNoticeKey: first!.key }]
    expect(buildTrialReminders({ users, subscriptions, settings, now, trialDays: TRIAL_DAYS })).toEqual([])
  })

  it('nicht an abbestellte Erinnerungen und nicht ohne E-Mail', () => {
    const subscriptions = [subAt(7, now)]
    expect(buildTrialReminders({ users, subscriptions, settings: [{ creatorId: 'u1', emailReminders: false }], now, trialDays: TRIAL_DAYS })).toEqual([])
    expect(buildTrialReminders({ users: [{ id: 'u1', email: null }], subscriptions, settings: [], now, trialDays: TRIAL_DAYS })).toEqual([])
  })
})
