/**
 * Meldung an den Betreiber bei neuen Anmeldungen. Reine Funktion für den täglichen Job (scripts/reminders.ts):
 * `$users` hat kein Erstelldatum, darum merkt sich `settings.signupNoticeAt` pro Nutzer, dass er gemeldet ist.
 */
import type { ReminderSetting, ReminderUser } from './reminders'
import { formatDate } from '../lib/locale'

export interface SignupNotice {
  /** Nutzer, die mit dieser Mail gemeldet werden; der Job setzt bei ihnen `signupNoticeAt` */
  userIds: string[]
  subject: string
  text: string
}

export function buildSignupNotice(input: {
  users: ReminderUser[]
  settings: Pick<ReminderSetting, 'creatorId' | 'signupNoticeAt'>[]
  now: Date
}): SignupNotice | null {
  const known = new Set(input.settings.filter(s => s.signupNoticeAt).map(s => s.creatorId))
  const fresh = input.users.filter(u => !known.has(u.id))
  if (fresh.length === 0)
    return null

  const subject = fresh.length === 1 ? 'Wartungsheft: neue Anmeldung' : `Wartungsheft: ${fresh.length} neue Anmeldungen`
  const text = [
    `Neu angemeldet (gemeldet am ${formatDate(input.now.toISOString().slice(0, 10))}):`,
    '',
    ...fresh.map(u => `- ${u.email || `ohne E-Mail, ID ${u.id}`}`),
    '',
    `Konten insgesamt: ${input.users.length}`,
  ].join('\n')

  return { userIds: fresh.map(u => u.id), subject, text }
}
