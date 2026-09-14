import type { MaintenanceCategory } from './ai'
import { categoryLabel } from './report'

export interface ScheduleItem {
  type: MaintenanceCategory
  label: string
  intervalKm: number
  intervalMonths: number
}

export interface LastMaintenance {
  type: string
  /** 0 oder undefined bedeutet unbekannt, dann zählt nur die Zeit */
  mileageAtService?: number | null
  doneAt: string
}

/** done = erledigt und nicht bald fällig, due = innerhalb der Vorwarnung, overdue = überschritten, unknown = kein Eintrag vorhanden */
export type DueStatus = 'done' | 'due' | 'overdue' | 'unknown'

/** Vorwarnung: so viele Tage oder Kilometer vor dem Termin gilt eine Arbeit als «bald fällig» */
export const DUE_SOON_DAYS = 30
export const DUE_SOON_KM = 1000

export interface DueResult {
  type: string
  label: string
  status: DueStatus
  lastDoneAt?: string
  lastMileage?: number
  nextDueDate?: string
  nextDueMileage?: number
}

const DEFAULT_SCHEDULE: ScheduleItem[] = [
  { type: 'oelwechsel', label: 'Ölwechsel', intervalKm: 15000, intervalMonths: 12 },
  { type: 'inspektion', label: 'Inspektion', intervalKm: 30000, intervalMonths: 24 },
  { type: 'bremsen', label: 'Bremsen prüfen', intervalKm: 30000, intervalMonths: 24 },
  { type: 'reifen', label: 'Reifenwechsel', intervalKm: 40000, intervalMonths: 48 },
  { type: 'luftfilter', label: 'Luftfilter', intervalKm: 40000, intervalMonths: 36 },
  { type: 'zahnriemen', label: 'Zahnriemen', intervalKm: 120000, intervalMonths: 72 },
  { type: 'bremsflüssigkeit', label: 'Bremsflüssigkeit', intervalKm: 60000, intervalMonths: 24 },
  { type: 'klimaanlage', label: 'Klimaanlage Service', intervalKm: 0, intervalMonths: 24 },
  { type: 'tuev', label: 'MFK / Prüfung', intervalKm: 0, intervalMonths: 24 },
]

export function getMaintenanceSchedule(customSchedule?: ScheduleItem[]): ScheduleItem[] {
  if (customSchedule?.length)
    return customSchedule
  return DEFAULT_SCHEDULE
}

function addMonths(dateStr: string, months: number): Date {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d
}

function knownMileage(m: LastMaintenance): number | undefined {
  return m.mileageAtService ? m.mileageAtService : undefined
}

/** Neuester Eintrag pro Typ: nach Datum, bei gleichem Datum nach Kilometerstand */
function latestByType(maintenances: LastMaintenance[]): Map<string, LastMaintenance> {
  const latest = new Map<string, LastMaintenance>()
  for (const m of maintenances) {
    const cur = latest.get(m.type)
    if (!cur || m.doneAt > cur.doneAt || (m.doneAt === cur.doneAt && (knownMileage(m) ?? 0) > (knownMileage(cur) ?? 0)))
      latest.set(m.type, m)
  }
  return latest
}

export function checkDueMaintenances(params: {
  currentMileage: number
  lastMaintenances: LastMaintenance[]
  schedule: ScheduleItem[]
}): DueResult[] {
  const { currentMileage, lastMaintenances, schedule } = params
  const now = new Date()
  const latest = latestByType(lastMaintenances)

  const scheduleResults = schedule.map((item) => {
    const last = latest.get(item.type)
    if (!last) {
      return {
        type: item.type,
        label: item.label,
        status: 'unknown' as const,
      }
    }

    const lastMileage = knownMileage(last)
    const nextDueMileage = item.intervalKm > 0 && lastMileage !== undefined
      ? lastMileage + item.intervalKm
      : undefined

    const nextDueDate = addMonths(last.doneAt, item.intervalMonths)

    const overdueByKm = nextDueMileage !== undefined && currentMileage >= nextDueMileage
    const overdueByDate = now >= nextDueDate
    const soonByKm = nextDueMileage !== undefined && currentMileage >= nextDueMileage - DUE_SOON_KM
    const soonByDate = now.getTime() >= nextDueDate.getTime() - DUE_SOON_DAYS * 86_400_000

    let status: DueStatus = 'done'
    if (overdueByKm || overdueByDate)
      status = 'overdue'
    else if (soonByKm || soonByDate)
      status = 'due'

    return {
      type: item.type,
      label: item.label,
      status,
      lastDoneAt: last.doneAt,
      lastMileage,
      nextDueDate: nextDueDate.toISOString().split('T')[0],
      nextDueMileage,
    }
  })

  // Erledigte Arbeiten ohne Intervall (Karosserie, Fahrwerk, Sonstiges …): ein Eintrag pro Typ, der neueste
  const scheduled = new Set<string>(schedule.map(s => s.type))
  const extraResults: DueResult[] = [...latest.values()]
    .filter(m => !scheduled.has(m.type))
    .map(m => ({
      type: m.type,
      label: categoryLabel(m.type),
      status: 'done' as const,
      lastDoneAt: m.doneAt,
      lastMileage: knownMileage(m),
    }))

  return [...scheduleResults, ...extraResults]
}
