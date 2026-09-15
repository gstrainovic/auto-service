/**
 * Serviceheft ohne Chat: Intervalle als bearbeitbare Zeilen, Hersteller-Intervalle aus dem Scan einmischen,
 * erledigte Arbeiten aus den Stempelseiten als Vorschlagsliste mit Duplikatprüfung.
 */
import type { MaintenanceCategory } from './categories'
import type { ScheduleItem } from './maintenance-schedule'
import { MAINTENANCE_CATEGORIES } from './categories'
import { getMaintenanceSchedule } from './maintenance-schedule'
import { categoryLabel } from './report'

export interface ScheduleRow extends ScheduleItem {
  /** stabiler Schlüssel für v-for, auch wenn eine Art mehrfach vorkommt */
  key: string
}

export interface ScannedInterval {
  type: string
  label?: string
  intervalKm: number
  intervalMonths: number
}

export interface ServiceBookPage {
  date?: string | null
  mileage?: number | null
  workshopName?: string | null
  items?: { description: string, category: string }[]
}

export interface BookEntry {
  key: string
  type: MaintenanceCategory
  description: string
  doneAt: string
  mileage: number | null
  workshop?: string
  /** gleiche Art ist schon höchstens 14 Tage daneben erfasst */
  duplicate: boolean
  /** Kilometerstand passt nicht zur Datumsfolge der anderen Stempel (Handschrift falsch gelesen) */
  doubtful: boolean
  selected: boolean
}

const DUPLICATE_DAYS = 14
let rowCounter = 0
const nextKey = () => `row-${++rowCounter}`

function isCategory(type: string): type is MaintenanceCategory {
  return (MAINTENANCE_CATEGORIES as readonly string[]).includes(type)
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
}

/** Aktueller Plan als Zeilen: eigener Plan, sonst die allgemeinen Intervalle als Startpunkt */
export function scheduleRows(current: ScheduleItem[] | undefined): ScheduleRow[] {
  return getMaintenanceSchedule(current).map(s => ({ ...s, key: nextKey() }))
}

/** Ab so vielen Arten mit demselben Intervall stammt die Angabe aus der Checkliste einer Wartung, nicht aus eigenen Intervallen */
const SPREAD_LIMIT = 4

/** Grenzen, ab denen ein gelesenes Intervall nicht mehr plausibel ist (10 Jahre, 300'000 km) */
const MAX_MONTHS = 120
const MAX_KM = 300_000

/** Hersteller-Intervalle übernehmen: gleiche Art überschreibt die erste Zeile dieser Art, neue Arten kommen hinten dazu */
export function mergeIntervals(rows: ScheduleRow[], intervals: ScannedInterval[]): { rows: ScheduleRow[], changed: number, ignored: number } {
  const next = rows.map(r => ({ ...r }))
  const spread = new Map<string, number>()
  for (const i of intervals) {
    const key = `${i.intervalKm || 0}|${i.intervalMonths || 0}`
    spread.set(key, (spread.get(key) ?? 0) + 1)
  }
  let changed = 0
  let ignored = 0
  for (const interval of intervals) {
    const km = interval.intervalKm || 0
    const months = interval.intervalMonths || 0
    if ((spread.get(`${km}|${months}`) ?? 0) >= SPREAD_LIMIT) {
      ignored++
      continue
    }
    if (!isCategory(interval.type) || (!km && !months) || months > MAX_MONTHS || km > MAX_KM)
      continue
    const row = next.find(r => r.type === interval.type)
    if (row) {
      if (row.intervalKm === km && row.intervalMonths === months)
        continue
      row.intervalKm = km
      row.intervalMonths = months
    }
    else {
      next.push({ key: nextKey(), type: interval.type, label: interval.label?.trim() || categoryLabel(interval.type), intervalKm: km, intervalMonths: months })
    }
    changed++
  }
  return { rows: changed ? next : rows, changed, ignored }
}

/** Zeilen zum Speichern: ohne jedes Intervall weglassen, leere Bezeichnung mit dem Kategorienamen füllen */
export function rowsToSchedule(rows: ScheduleRow[]): ScheduleItem[] {
  return rows
    .map(r => ({ type: r.type, label: r.label.trim() || categoryLabel(r.type), intervalKm: r.intervalKm || 0, intervalMonths: r.intervalMonths || 0 }))
    .filter(r => r.intervalKm > 0 || r.intervalMonths > 0)
}

/**
 * Kilometerstände müssen mit dem Datum steigen. Die längste steigende Folge gilt als richtig gelesen,
 * alles andere ist zweifelhaft (bei Handschrift liest die OCR oft eine Ziffer falsch).
 */
function markDoubtful(entries: BookEntry[]): void {
  // pro Datum zählt ein Stempel; mehrere Arbeiten am selben Tag dürfen die Folge nicht verzerren
  const byDate = new Map<string, BookEntry>()
  for (const entry of entries) {
    if (entry.mileage && !byDate.has(entry.doneAt))
      byDate.set(entry.doneAt, entry)
  }
  const dated = [...byDate.values()].sort((a, b) => a.doneAt.localeCompare(b.doneAt))
  if (dated.length < 3)
    return
  // längste nicht fallende Teilfolge, O(n²) reicht für ein Serviceheft
  const best = dated.map(() => 1)
  const from = dated.map(() => -1)
  for (let i = 1; i < dated.length; i++) {
    for (let j = 0; j < i; j++) {
      if (dated[j]!.mileage! <= dated[i]!.mileage! && best[j]! + 1 > best[i]!) {
        best[i] = best[j]! + 1
        from[i] = j
      }
    }
  }
  let end = 0
  for (let i = 1; i < dated.length; i++) {
    if (best[i]! > best[end]!)
      end = i
  }
  const plausible = new Set<BookEntry>()
  for (let i = end; i >= 0; i = from[i]!) {
    plausible.add(dated[i]!)
    if (from[i] === -1)
      break
  }
  for (const entry of entries) {
    const leading = byDate.get(entry.doneAt)
    if (leading && !plausible.has(leading)) {
      entry.doubtful = true
      entry.selected = false
    }
  }
}

/** Stempel aus dem Serviceheft als Wartungsvorschläge: pro Datum und Art ein Eintrag, schon Erfasstes abgewählt */
export function serviceBookEntries(pages: ServiceBookPage[], existing: { type: string, doneAt: string, status: string }[]): BookEntry[] {
  const done = existing.filter(m => m.status === 'done')
  const byKey = new Map<string, BookEntry>()
  for (const page of pages) {
    const date = page.date
    if (!date || !isIsoDate(date))
      continue
    for (const item of page.items ?? []) {
      const type = isCategory(item.category) ? item.category : 'sonstiges'
      const key = `${date}|${type}`
      const found = byKey.get(key)
      if (found) {
        if (item.description && !found.description.includes(item.description))
          found.description = [found.description, item.description].filter(Boolean).join(', ')
        continue
      }
      const duplicate = done.some(m => m.type === type && Math.abs(Date.parse(m.doneAt) - Date.parse(date)) / 86_400_000 <= DUPLICATE_DAYS)
      byKey.set(key, {
        key,
        type,
        description: item.description?.trim() ?? '',
        doneAt: date,
        mileage: page.mileage || null,
        workshop: page.workshopName || undefined,
        duplicate,
        doubtful: false,
        selected: !duplicate,
      })
    }
  }
  const entries = [...byKey.values()]
  markDoubtful(entries)
  // neueste zuerst, gleiches Datum in der Reihenfolge des Hefts
  return entries.sort((a, b) => b.doneAt.localeCompare(a.doneAt))
}
