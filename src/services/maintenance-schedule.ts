import type { MaintenanceCategory } from './ai'
import { formatDate, formatNumber } from '../lib/locale'
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
  /** unterscheidet Plan-Einträge gleicher Art, z. B. «Getriebeöl» und «Differentialöl» (beide `sonstiges`) */
  description?: string
}

/** done = erledigt und nicht bald fällig, due = innerhalb der Vorwarnung, overdue = überschritten, unknown = kein Eintrag vorhanden */
export type DueStatus = 'done' | 'due' | 'overdue' | 'unknown'

/** Darstellung eines Status, gleich in Dashboard und Wartungsplan der Fahrzeugseite */
export const DUE_STATUS_VIEW: Record<DueStatus, { label: string, icon: string, color: string, severity: 'danger' | 'warn' | 'success' | 'secondary' }> = {
  overdue: { label: 'Überfällig', icon: 'pi pi-exclamation-triangle', color: 'var(--p-red-500)', severity: 'danger' },
  due: { label: 'Bald fällig', icon: 'pi pi-clock', color: 'var(--p-yellow-500)', severity: 'warn' },
  unknown: { label: 'Kein Eintrag', icon: 'pi pi-question-circle', color: 'var(--p-text-muted-color)', severity: 'secondary' },
  done: { label: 'OK', icon: 'pi pi-check-circle', color: 'var(--p-green-500)', severity: 'success' },
}

/** Vorwarnung: so viele Tage oder Kilometer vor dem Termin gilt eine Arbeit als «bald fällig» */
export const DUE_SOON_DAYS = 30
export const DUE_SOON_KM = 1000

export interface DueResult {
  /** eindeutig je Plan-Eintrag; die Art allein reicht nicht, sie kann mehrfach vorkommen */
  key: string
  type: string
  label: string
  status: DueStatus
  lastDoneAt?: string
  lastMileage?: number
  nextDueDate?: string
  nextDueMileage?: number
  /** vereinbarter Termin in der Zukunft (Wartung mit Status «Geplant») */
  plannedAt?: string
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

/** Kalendermonate addieren, Tag ans Monatsende klammern (31.01. + 1 = 28./29.02.); Ergebnis als YYYY-MM-DD ohne Zeitzone. */
export function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number) as [number, number, number]
  const total = y * 12 + (m - 1) + months
  const year = Math.floor(total / 12)
  const month = total - year * 12 + 1
  const day = Math.min(d, new Date(year, month, 0).getDate())
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** ISO-Tag als lokale Mitternacht, damit der Vergleich mit «jetzt» nicht an der Zeitzone hängt */
function localDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d)
}

function knownMileage(m: LastMaintenance): number | undefined {
  return m.mileageAtService ? m.mileageAtService : undefined
}

function labelWords(label: string): string[] {
  return label.toLowerCase().split(/[^a-zäöüß0-9]+/).filter(w => w.length > 3)
}

function describes(m: LastMaintenance, words: string[]): boolean {
  const text = (m.description ?? '').toLowerCase()
  return !!text && words.some(w => text.includes(w))
}

/**
 * Neuester Eintrag, der zur Bezeichnung des Plan-Eintrags passt; ohne Treffer der neueste der Art, aber keiner,
 * dessen Beschreibung eindeutig zu einem anderen Plan-Eintrag derselben Art gehört
 */
function latestMatching(maintenances: LastMaintenance[], item: ScheduleItem, siblings: ScheduleItem[]): LastMaintenance | undefined {
  const sameType = maintenances.filter(m => m.type === item.type)
  const matching = sameType.filter(m => describes(m, labelWords(item.label)))
  const others = siblings.filter(s => s !== item).map(s => labelWords(s.label))
  const unclaimed = sameType.filter(m => !others.some(words => describes(m, words)))
  return latestByType(matching.length ? matching : unclaimed).get(item.type)
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
  /** Wartungen mit Status «Geplant»: vereinbarte Termine, noch nicht erledigt */
  plannedMaintenances?: { type: string, doneAt: string }[]
}): DueResult[] {
  const { currentMileage, lastMaintenances, schedule, plannedMaintenances = [] } = params
  const now = new Date()
  const latest = latestByType(lastMaintenances)
  const today = now.toISOString().slice(0, 10)
  // pro Typ der nächste Termin, der noch bevorsteht
  const planned = new Map<string, string>()
  for (const p of plannedMaintenances) {
    if (p.doneAt < today)
      continue
    const cur = planned.get(p.type)
    if (!cur || p.doneAt < cur)
      planned.set(p.type, p.doneAt)
  }

  // Arten, die im Plan mehrfach vorkommen: dort entscheidet die Beschreibung, zu welchem Eintrag eine Wartung gehört
  const perType = new Map<string, number>()
  for (const item of schedule)
    perType.set(item.type, (perType.get(item.type) ?? 0) + 1)

  const scheduleResults = schedule.map((item) => {
    const key = `${item.type}|${item.label}`
    const last = (perType.get(item.type) ?? 0) > 1
      ? latestMatching(lastMaintenances, item, schedule.filter(s => s.type === item.type))
      : latest.get(item.type)
    if (!last) {
      return {
        key,
        type: item.type,
        label: item.label,
        status: 'unknown' as const,
        plannedAt: planned.get(item.type),
      }
    }

    const lastMileage = knownMileage(last)
    const nextDueMileage = item.intervalKm > 0 && lastMileage !== undefined
      ? lastMileage + item.intervalKm
      : undefined

    const nextDueDate = addMonths(last.doneAt, item.intervalMonths)
    const nextDue = localDate(nextDueDate)

    const overdueByKm = nextDueMileage !== undefined && currentMileage >= nextDueMileage
    const overdueByDate = now >= nextDue
    const soonByKm = nextDueMileage !== undefined && currentMileage >= nextDueMileage - DUE_SOON_KM
    const soonByDate = now.getTime() >= nextDue.getTime() - DUE_SOON_DAYS * 86_400_000

    let status: DueStatus = 'done'
    if (overdueByKm || overdueByDate)
      status = 'overdue'
    else if (soonByKm || soonByDate)
      status = 'due'

    return {
      key,
      type: item.type,
      label: item.label,
      status,
      lastDoneAt: last.doneAt,
      lastMileage,
      nextDueDate,
      nextDueMileage,
      plannedAt: planned.get(item.type),
    }
  })

  // Erledigte Arbeiten ohne Intervall (Karosserie, Fahrwerk, Sonstiges …): ein Eintrag pro Typ, der neueste
  const scheduled = new Set<string>(schedule.map(s => s.type))
  const extraResults: DueResult[] = [...latest.values()]
    .filter(m => !scheduled.has(m.type))
    .map(m => ({
      key: m.type,
      type: m.type,
      label: categoryLabel(m.type),
      status: 'done' as const,
      lastDoneAt: m.doneAt,
      lastMileage: knownMileage(m),
    }))

  return [...scheduleResults, ...extraResults]
}

/** Fälligkeiten eines Fahrzeugs aus allen seinen Wartungen: erledigte zählen als «zuletzt», geplante als Termin */
export function dueForVehicle(
  vehicle: { mileage: number, customSchedule?: ScheduleItem[] | { type: string, label: string, intervalKm: number, intervalMonths: number }[] },
  maintenances: { type: string, status?: string, doneAt: string, mileageAtService?: number | null, description?: string }[],
): DueResult[] {
  return checkDueMaintenances({
    currentMileage: vehicle.mileage,
    lastMaintenances: maintenances
      .filter(m => m.status === 'done')
      .map(m => ({ type: m.type, mileageAtService: m.mileageAtService, doneAt: m.doneAt, description: m.description })),
    plannedMaintenances: maintenances
      .filter(m => m.status !== 'done')
      .map(m => ({ type: m.type, doneAt: m.doneAt })),
    schedule: getMaintenanceSchedule(vehicle.customSchedule as ScheduleItem[] | undefined),
  })
}

/**
 * Vorbelegung für «Eintragen» an einer Arbeit: Fälliges ist meist heute erledigt; noch nie Erfasstes fragt
 * «wann zuletzt», dort wäre heute falsch. Kilometerstand 0 heisst unbekannt.
 */
export function doneFormInitial(item: DueResult, vehicleMileage: number, today: string): { category: MaintenanceCategory, date: string, mileage: number | undefined, status: 'done', description: string } {
  const unknown = item.status === 'unknown'
  return {
    category: item.type as MaintenanceCategory,
    date: unknown ? '' : today,
    mileage: unknown || !vehicleMileage ? undefined : vehicleMileage,
    status: 'done',
    // Bezeichnung aus dem Plan: ordnet den Eintrag bei doppelter Art (Getriebeöl, Differentialöl) der richtigen Zeile zu
    description: item.label,
  }
}

export interface FleetDueEntry {
  vehicleId: string
  vehicleName: string
  item: DueResult
}

/** Fälliges über alle Fahrzeuge für den Flottenblick: nur bald fällig und überfällig, überfällig zuerst, dann nach Termin */
export function fleetDueList(
  vehicles: { id: string, make: string, model: string, licensePlate?: string }[],
  dueMap: Record<string, DueResult[]>,
): FleetDueEntry[] {
  const rank = (s: DueStatus) => (s === 'overdue' ? 0 : 1)
  return vehicles
    .flatMap(v => (dueMap[v.id] ?? [])
      .filter(item => item.status === 'due' || item.status === 'overdue')
      .map(item => ({ vehicleId: v.id, vehicleName: `${v.make} ${v.model}${v.licensePlate ? ` · ${v.licensePlate}` : ''}`, item })))
    .sort((a, b) => rank(a.item.status) - rank(b.item.status)
      || (a.item.nextDueDate ?? '9999').localeCompare(b.item.nextDueDate ?? '9999'))
}

/** Kurzbeschreibung des Termins: «fällig seit …», «fällig am …», «nächste am …», jeweils mit Kilometern falls bekannt */
export function dueDescription(item: DueResult): string {
  const appointment = item.plannedAt ? `Termin am ${formatDate(item.plannedAt)}` : ''
  if (item.status === 'unknown')
    return appointment || 'noch nie erfasst'
  const parts: string[] = []
  const prefix = item.status === 'overdue' ? 'fällig seit' : item.status === 'due' ? 'fällig am' : 'nächste am'
  if (item.nextDueDate)
    parts.push(formatDate(item.nextDueDate))
  if (item.nextDueMileage)
    parts.push(`${item.status === 'overdue' ? '' : 'bei '}${formatNumber(item.nextDueMileage)} km`)
  if (!parts.length)
    return appointment
  return [`${prefix} ${parts.join(' oder ')}`, appointment].filter(Boolean).join(', ')
}

/** Zustand eines Fahrzeugs für Karte und Kopfzeile; ohne jeden erfassten Eintrag «unknown», nicht «ok» */
export function vehicleDueStatus(items: DueResult[]): 'overdue' | 'due' | 'ok' | 'unknown' {
  if (items.some(i => i.status === 'overdue'))
    return 'overdue'
  if (items.some(i => i.status === 'due'))
    return 'due'
  return items.some(i => i.status === 'done') ? 'ok' : 'unknown'
}
