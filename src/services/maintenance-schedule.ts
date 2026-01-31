import type { MaintenanceCategory } from './ai'

export interface ScheduleItem {
  type: MaintenanceCategory
  label: string
  intervalKm: number
  intervalMonths: number
}

export interface LastMaintenance {
  type: string
  mileageAtService: number
  doneAt: string
}

export interface DueResult {
  type: string
  label: string
  status: 'done' | 'due' | 'overdue'
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
  { type: 'tuev', label: 'TÜV / HU', intervalKm: 0, intervalMonths: 24 },
]

const BRAND_SCHEDULES: Record<string, ScheduleItem[]> = {
  BMW: [
    { type: 'oelwechsel', label: 'Ölwechsel', intervalKm: 15000, intervalMonths: 12 },
    { type: 'inspektion', label: 'Inspektion', intervalKm: 30000, intervalMonths: 24 },
    { type: 'bremsen', label: 'Bremsen prüfen', intervalKm: 30000, intervalMonths: 24 },
    { type: 'reifen', label: 'Reifenwechsel', intervalKm: 40000, intervalMonths: 48 },
    { type: 'luftfilter', label: 'Luftfilter', intervalKm: 60000, intervalMonths: 48 },
    { type: 'zahnriemen', label: 'Steuerkette (Sichtprüfung)', intervalKm: 100000, intervalMonths: 60 },
    { type: 'bremsflüssigkeit', label: 'Bremsflüssigkeit', intervalKm: 0, intervalMonths: 24 },
    { type: 'klimaanlage', label: 'Klimaanlage Service', intervalKm: 0, intervalMonths: 24 },
    { type: 'tuev', label: 'TÜV / HU', intervalKm: 0, intervalMonths: 24 },
  ],
}

export function getMaintenanceSchedule(make: string, _model: string): ScheduleItem[] {
  return BRAND_SCHEDULES[make] || DEFAULT_SCHEDULE
}

function addMonths(dateStr: string, months: number): Date {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d
}

const CATEGORY_LABELS: Record<string, string> = {
  oelwechsel: 'Ölwechsel',
  inspektion: 'Inspektion',
  bremsen: 'Bremsen',
  reifen: 'Reifen',
  luftfilter: 'Luftfilter',
  zahnriemen: 'Zahnriemen',
  bremsflüssigkeit: 'Bremsflüssigkeit',
  klimaanlage: 'Klimaanlage',
  tuev: 'TÜV / HU',
  karosserie: 'Karosserie',
  elektrik: 'Elektrik',
  sonstiges: 'Sonstiges',
}

export function checkDueMaintenances(params: {
  currentMileage: number
  lastMaintenances: LastMaintenance[]
  schedule: ScheduleItem[]
}): DueResult[] {
  const { currentMileage, lastMaintenances, schedule } = params
  const now = new Date()
  const matchedTypes = new Set<string>()

  const scheduleResults = schedule.map((item) => {
    const last = lastMaintenances.find(m => m.type === item.type)
    if (last)
      matchedTypes.add(last.type)

    if (!last) {
      return {
        type: item.type,
        label: item.label,
        status: 'due' as const,
      }
    }

    const nextDueMileage = item.intervalKm > 0
      ? last.mileageAtService + item.intervalKm
      : undefined

    const nextDueDate = addMonths(last.doneAt, item.intervalMonths)

    const overdueByKm = nextDueMileage !== undefined && currentMileage >= nextDueMileage
    const overdueByDate = now >= nextDueDate

    let status: 'done' | 'due' | 'overdue' = 'done'
    if (overdueByKm || overdueByDate) {
      status = 'overdue'
    }

    return {
      type: item.type,
      label: item.label,
      status,
      lastDoneAt: last.doneAt,
      lastMileage: last.mileageAtService,
      nextDueDate: nextDueDate.toISOString().split('T')[0],
      nextDueMileage,
    }
  })

  // Add non-schedule maintenances (karosserie, elektrik, sonstiges, etc.)
  const extraResults: DueResult[] = lastMaintenances
    .filter(m => !matchedTypes.has(m.type))
    .map(m => ({
      type: m.type,
      label: CATEGORY_LABELS[m.type] || m.type,
      status: 'done' as const,
      lastDoneAt: m.doneAt,
      lastMileage: m.mileageAtService,
    }))

  return [...scheduleResults, ...extraResults]
}
