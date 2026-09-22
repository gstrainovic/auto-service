/**
 * Anstoss vor Ende der Testzeit: in der App ein Hinweis in der letzten Woche, dazu eine Mail sieben Tage vorher.
 * Reine Funktionen, damit Dashboard (`trialNotice`) und Server-Job (`buildTrialReminders`, scripts/reminders.ts)
 * dieselbe Regel nutzen. Der Zustand der Testzeit kommt aus dem AI-Proxy (`trial.ts`), die Abos stehen in der
 * Entität `subscriptions`.
 */
import type { ReminderSetting } from './reminders'
import { formatDate } from '../lib/locale'
import { APP_URL } from './reminders'

/** Ab so vielen verbleibenden Tagen weist die App auf das Abo hin (Tag 23 von 30) */
export const NOTICE_DAYS_LEFT = 7

export interface TrialInfo {
  active: boolean
  daysLeft: number
  /** ISO-Datum des letzten Testtags */
  endsAt: string
}

/** Abo-Zeile aus InstantDB, wie der Proxy sie schreibt */
export interface TrialSubscription {
  userId: string
  status: string
  trialStartedAt?: string | null
}

export interface TrialReminder {
  userId: string
  email: string
  subject: string
  text: string
  /** Merker gegen Wiederholung: eine Mail pro Testzeit */
  key: string
}

/**
 * Hinweistext für die App, oder null solange die Testzeit noch lange läuft. Nach Ablauf bleibt der Hinweis stehen,
 * dann nennt er den Grund statt der Restzeit.
 */
export function trialNotice(trial: TrialInfo | null | undefined): string | null {
  if (!trial)
    return null
  if (!trial.active)
    return 'Testzeit vorbei: Scannen und Chat brauchen ein Abo. Erfassen von Hand, Lesen und Exporte bleiben frei.'
  if (trial.daysLeft > NOTICE_DAYS_LEFT)
    return null
  const days = trial.daysLeft === 1 ? 'noch 1 Tag' : `noch ${trial.daysLeft} Tage`
  return `Testzeit läuft ${days}, bis ${formatDate(trial.endsAt)}. Danach brauchen Scannen und Chat ein Abo.`
}

/** Verbleibende Tage einer Testzeit aus ihrem Beginn; dieselbe Rechnung wie `trialState` im AI-Proxy */
export function trialDaysLeft(trialStartedAt: string, now: Date, trialDays: number): number {
  const end = new Date(trialStartedAt).getTime() + trialDays * 86_400_000
  return Math.max(0, Math.ceil((end - now.getTime()) / 86_400_000))
}

/**
 * Eine Mail pro Nutzer, dessen Testzeit in sieben Tagen endet. Wer schon bestellt hat (Status nicht mehr `trial`)
 * oder die Mail bereits bekommen hat, wird übersprungen; Erinnerungen abbestellen schaltet auch diese Mail ab.
 */
export function buildTrialReminders(input: {
  users: { id: string, email?: string | null }[]
  subscriptions: TrialSubscription[]
  settings: ReminderSetting[]
  now: Date
  trialDays: number
}): TrialReminder[] {
  const { users, subscriptions, settings, now, trialDays } = input
  const byUser = new Map(settings.map(s => [s.creatorId, s]))
  const subs = new Map(subscriptions.map(s => [s.userId, s]))
  const reminders: TrialReminder[] = []

  for (const user of users) {
    if (!user.email)
      continue
    if (byUser.get(user.id)?.emailReminders === false)
      continue
    const sub = subs.get(user.id)
    if (!sub?.trialStartedAt || sub.status !== 'trial')
      continue
    const daysLeft = trialDaysLeft(sub.trialStartedAt, now, trialDays)
    if (daysLeft !== NOTICE_DAYS_LEFT)
      continue
    const key = `trial:${sub.trialStartedAt}`
    if (byUser.get(user.id)?.lastTrialNoticeKey === key)
      continue
    const endsAt = new Date(new Date(sub.trialStartedAt).getTime() + trialDays * 86_400_000).toISOString().slice(0, 10)
    reminders.push({
      userId: user.id,
      email: user.email,
      key,
      subject: `Wartungsheft: Testzeit endet am ${formatDate(endsAt)}`,
      text: [
        'Hallo',
        '',
        `deine Testzeit läuft noch ${NOTICE_DAYS_LEFT} Tage, bis zum ${formatDate(endsAt)}.`,
        '',
        'Danach brauchen der Beleg-Scan und der Chat ein Abo. Alles andere bleibt: deine Fahrzeuge, Rechnungen und',
        'Wartungen bleiben lesbar, Erfassen von Hand und die Exporte funktionieren weiter.',
        '',
        `Abo bestellen: ${APP_URL}/settings`,
        '',
        'Privat kostet Wartungsheft 25 Franken im Jahr für bis zu fünf Fahrzeuge, Betriebe zahlen 36 Franken pro',
        'Fahrzeug und Jahr und bekommen die Rechnung auf die Firma. Die Rechnung kommt per Mail, zahlbar in 30 Tagen.',
        '',
        `Fragen? Einfach auf diese Mail antworten. Keine Erinnerungen mehr: ${APP_URL}/settings, Abschnitt «Erinnerungen».`,
        '',
        'Wartungsheft, ein Angebot von Strainovic IT, Steinach',
      ].join('\n'),
    })
  }
  return reminders
}
