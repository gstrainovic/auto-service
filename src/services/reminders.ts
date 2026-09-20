/**
 * E-Mail-Erinnerungen für fällige und überfällige Arbeiten. Reine Funktionen, damit der Server-Job
 * (scripts/reminders.ts) und die Tests dieselbe Logik nutzen. Fälligkeit kommt aus maintenance-schedule.ts.
 */
import type { DueResult } from './maintenance-schedule'
import { formatDate, formatNumber } from '../lib/locale'
import { checkDueMaintenances, getMaintenanceSchedule } from './maintenance-schedule'
import { activeVehicles } from './vehicle-status'

export interface ReminderUser {
  id: string
  email?: string | null
}

export interface ReminderVehicle {
  id: string
  creatorId: string
  make: string
  model: string
  licensePlate?: string
  mileage: number
  customSchedule?: any
  soldAt?: string | null
  soldMileage?: number | null
}

export interface ReminderMaintenance {
  vehicleId: string
  type: string
  doneAt: string
  mileageAtService?: number | null
  status: string
  description?: string
}

/** Entität `settings` in InstantDB, ein Dokument pro Nutzer (creatorId) */
export interface ReminderSetting {
  id?: string
  creatorId: string
  /** fehlt = eingeschaltet */
  emailReminders?: boolean
  lastReminderAt?: string
  lastReminderKey?: string
  /** Merker der Mail vor Ende der Testzeit (trial-reminder.ts), eine pro Testzeit */
  lastTrialNoticeKey?: string
}

export interface DueEntry {
  vehicleId: string
  type: string
  status: string
}

export interface Reminder {
  userId: string
  email: string
  subject: string
  text: string
  /** Fingerabdruck der fälligen Arbeiten, gegen Wiederholungen */
  key: string
  entries: DueEntry[]
}

export const APP_URL = 'https://wartungsheft.ch'
/** Unveränderte Erinnerung frühestens nach so vielen Tagen erneut senden */
export const REPEAT_AFTER_DAYS = 30

export function reminderKey(entries: DueEntry[]): string {
  return entries.map(e => `${e.vehicleId}:${e.type}:${e.status}`).sort().join('|')
}

export function shouldSend(setting: ReminderSetting | undefined, key: string, now: Date): boolean {
  if (!setting?.lastReminderKey || !setting.lastReminderAt)
    return true
  if (setting.lastReminderKey !== key)
    return true
  const last = new Date(setting.lastReminderAt).getTime()
  return now.getTime() - last >= REPEAT_AFTER_DAYS * 86_400_000
}

function vehicleName(v: ReminderVehicle): string {
  return `${v.make} ${v.model}`
}

function itemLine(item: DueResult): string {
  const when = item.nextDueDate ? formatDate(item.nextDueDate) : ''
  const km = item.nextDueMileage ? `${formatNumber(item.nextDueMileage)} km` : ''
  const target = [when, km].filter(Boolean).join(' oder ')
  if (item.status === 'overdue')
    return `- ${item.label}: überfällig${target ? ` (fällig war ${target})` : ''}`
  return `- ${item.label}: bald fällig${target ? ` (bis ${target})` : ''}`
}

function dueItems(v: ReminderVehicle, maintenances: ReminderMaintenance[]): DueResult[] {
  const own = maintenances.filter(m => m.vehicleId === v.id)
  const done = own.filter(m => m.status === 'done')
  return checkDueMaintenances({
    currentMileage: v.mileage,
    lastMaintenances: done.map(m => ({ type: m.type, doneAt: m.doneAt, mileageAtService: m.mileageAtService, description: m.description })),
    plannedMaintenances: own.filter(m => m.status !== 'done').map(m => ({ type: m.type, doneAt: m.doneAt })),
    schedule: getMaintenanceSchedule(v.customSchedule),
  })
    // vereinbarter Termin: der Nutzer weiss Bescheid, keine Erinnerung
    .filter(i => (i.status === 'due' || i.status === 'overdue') && !i.plannedAt)
}

export function buildReminders(input: {
  users: ReminderUser[]
  vehicles: ReminderVehicle[]
  maintenances: ReminderMaintenance[]
  settings: ReminderSetting[]
  now: Date
}): Reminder[] {
  const { users, vehicles, maintenances, settings, now } = input
  const today = now.toISOString().slice(0, 10)
  const byUser = new Map(settings.map(s => [s.creatorId, s]))
  const reminders: Reminder[] = []

  for (const user of users) {
    if (!user.email)
      continue
    if (byUser.get(user.id)?.emailReminders === false)
      continue

    const blocks: string[] = []
    const entries: DueEntry[] = []
    const names: string[] = []
    // verkaufte Fahrzeuge gehören dem Nutzer nicht mehr, ihre Termine sind seine Sache nicht
    for (const v of activeVehicles(vehicles.filter(v => v.creatorId === user.id), today)) {
      const items = dueItems(v, maintenances)
      if (!items.length)
        continue
      names.push(vehicleName(v))
      entries.push(...items.map(i => ({ vehicleId: v.id, type: i.type, status: i.status })))
      const head = [vehicleName(v), v.licensePlate, v.mileage ? `${formatNumber(v.mileage)} km` : ''].filter(Boolean).join(' · ')
      blocks.push([head, ...items.map(itemLine)].join('\n'))
    }
    if (!entries.length)
      continue

    const n = entries.length
    const subject = `Wartungsheft: ${n} ${n === 1 ? 'Arbeit' : 'Arbeiten'} fällig${names.length === 1 ? ` beim ${names[0]}` : ''}`
    const text = [
      'Hallo',
      '',
      `Bei ${names.length === 1 ? 'deinem Fahrzeug' : 'deinen Fahrzeugen'} ${n === 1 ? 'steht eine Arbeit' : `stehen ${n} Arbeiten`} an:`,
      '',
      blocks.join('\n\n'),
      '',
      // Ein Fahrzeug: direkt zu seinem Abschnitt; mehrere: zur Fälligkeitsliste oben im Dashboard
      `Details und Eintragen: ${APP_URL}/dashboard${names.length === 1 ? `#fahrzeug-${entries[0]!.vehicleId}` : ''}`,
      '',
      'Die Intervalle sind Standardwerte, solange kein Serviceheft hinterlegt ist. Erledigte Arbeiten trägst du im',
      'Wartungsheft ein, dann verschwindet die Erinnerung.',
      '',
      `Fragen? Einfach auf diese Mail antworten. Keine Erinnerungen mehr: ${APP_URL}/settings, Abschnitt «Erinnerungen».`,
      '',
      'Wartungsheft, ein Angebot von Strainovic IT, Steinach',
    ].join('\n')

    reminders.push({ userId: user.id, email: user.email, subject, text, key: reminderKey(entries), entries })
  }
  return reminders
}
