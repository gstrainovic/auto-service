/**
 * Auswertungen für Kostenübersicht, CSV-Export (Treuhänder, Excel) und PDF-Dossier (Verkauf).
 * Reine Funktionen ohne DOM, damit sie im Unit-Test laufen.
 */
import type { Invoice } from '../stores/invoices'
import type { Maintenance } from '../stores/maintenances'
import { DEFAULT_CURRENCY, formatNumber } from '../lib/locale'

const CATEGORY_LABELS: Record<string, string> = {
  oelwechsel: 'Ölwechsel',
  inspektion: 'Inspektion / Service',
  bremsen: 'Bremsen',
  reifen: 'Reifen',
  luftfilter: 'Luftfilter',
  zahnriemen: 'Zahnriemen',
  bremsflüssigkeit: 'Bremsflüssigkeit',
  klimaanlage: 'Klimaanlage',
  tuev: 'MFK / Prüfung',
  karosserie: 'Karosserie',
  elektrik: 'Elektrik',
  fahrwerk: 'Fahrwerk',
  auspuff: 'Auspuff',
  kuehlung: 'Kühlung',
  autoglas: 'Autoglas',
  sonstiges: 'Sonstiges',
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category
}

export interface YearCosts {
  year: number
  currency: string
  total: number
  byCategory: Record<string, number>
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function yearOf(date: string): number {
  return Number.parseInt(date.slice(0, 4), 10) || 0
}

/** Summen pro Jahr und Währung, aufgeteilt nach Kategorie der Positionen; Rechnungen ohne Positionen zählen als «sonstiges». */
export function costsByYear(invoices: Invoice[]): YearCosts[] {
  const map = new Map<string, YearCosts>()
  for (const inv of invoices) {
    const year = yearOf(inv.date)
    const currency = inv.currency || DEFAULT_CURRENCY
    const key = `${year}|${currency}`
    let row = map.get(key)
    if (!row) {
      row = { year, currency, total: 0, byCategory: {} }
      map.set(key, row)
    }
    const items = inv.items?.length ? inv.items : [{ description: '', category: 'sonstiges', amount: inv.totalAmount ?? 0 }]
    for (const item of items) {
      const cat = item.category || 'sonstiges'
      row.byCategory[cat] = round2((row.byCategory[cat] ?? 0) + (item.amount ?? 0))
    }
    row.total = round2(row.total + (inv.totalAmount ?? 0))
  }
  return [...map.values()].sort((a, b) => b.year - a.year || a.currency.localeCompare(b.currency))
}

export interface VehicleInfo {
  make: string
  model: string
  licensePlate: string
  year?: number
  vin?: string
  mileage?: number
}

function csvCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null)
    return ''
  const s = String(value)
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Eine Zeile pro Rechnungsposition, Semikolon-getrennt mit BOM, damit Excel (de-CH) die Datei direkt richtig öffnet. */
export function invoicesToCsv(invoices: Invoice[], vehicle: VehicleInfo): string {
  const header = ['Fahrzeug', 'Kennzeichen', 'Datum', 'Werkstatt', 'Kilometerstand', 'Kategorie', 'Beschreibung', 'Betrag', 'Währung']
  const rows: string[][] = []
  const sorted = [...invoices].sort((a, b) => a.date.localeCompare(b.date))
  for (const inv of sorted) {
    const items = inv.items?.length ? inv.items : [{ description: '', category: 'sonstiges', amount: inv.totalAmount ?? 0 }]
    for (const item of items) {
      rows.push([
        `${vehicle.make} ${vehicle.model}`,
        vehicle.licensePlate,
        inv.date,
        inv.workshopName ?? '',
        inv.mileageAtService === undefined || inv.mileageAtService === null ? '' : String(inv.mileageAtService),
        categoryLabel(item.category || 'sonstiges'),
        item.description ?? '',
        (item.amount ?? 0).toFixed(2),
        inv.currency || DEFAULT_CURRENCY,
      ])
    }
  }
  const lines = [header, ...rows].map(cols => cols.map(csvCell).join(';'))
  return String.fromCharCode(0xFEFF) + lines.join('\r\n')
}

/** Wartungshistorie für das Dossier, neueste zuerst. */
export function maintenanceRows(maintenances: Maintenance[]): string[][] {
  return [...maintenances]
    .sort((a, b) => b.doneAt.localeCompare(a.doneAt))
    .map(m => [m.doneAt, m.description || categoryLabel(m.type), `${formatNumber(m.mileageAtService)} km`])
}
