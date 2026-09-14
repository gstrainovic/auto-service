/**
 * Auswertungen für Kostenübersicht, CSV-Export (Treuhänder, Excel) und PDF-Dossier (Verkauf).
 * Reine Funktionen ohne DOM, damit sie im Unit-Test laufen. Mit `homeCurrency` und `rates`
 * (siehe fx.ts) werden fremde Währungen zum Kurs am Rechnungsdatum umgerechnet; ohne Kurs bleibt
 * eine Rechnung in ihrer Währung und wird als «nicht umgerechnet» gezählt.
 */
import type { Invoice } from '../stores/invoices'
import type { Maintenance } from '../stores/maintenances'
import type { RateMap } from './fx'
import { DEFAULT_CURRENCY, formatNumber } from '../lib/locale'
import { rateKey } from './fx'

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

export interface CurrencyOptions {
  homeCurrency: string
  rates: RateMap
}

export interface YearCosts {
  year: number
  currency: string
  total: number
  byCategory: Record<string, number>
  /** Rechnungen, die aus einer fremden Währung umgerechnet wurden */
  converted: number
  /** Rechnungen in fremder Währung ohne Kurs, stehen in ihrer eigenen Zeile */
  unconverted: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function yearOf(date: string): number {
  return Number.parseInt(date.slice(0, 4), 10) || 0
}

interface Priced {
  currency: string
  factor: number
  converted: boolean
  unconverted: boolean
}

/** Entscheidet pro Rechnung, in welcher Währung und mit welchem Faktor sie zählt. */
function price(inv: Invoice, opts?: CurrencyOptions): Priced {
  const currency = inv.currency || DEFAULT_CURRENCY
  if (!opts || currency === opts.homeCurrency)
    return { currency, factor: 1, converted: false, unconverted: false }
  // Kurs ungerundet als Faktor; gerundet wird erst der Betrag
  const rate = opts.rates.get(rateKey(currency, opts.homeCurrency, inv.date))
  if (rate === undefined)
    return { currency, factor: 1, converted: false, unconverted: true }
  return { currency: opts.homeCurrency, factor: rate, converted: true, unconverted: false }
}

function itemsOf(inv: Invoice) {
  return inv.items?.length ? inv.items : [{ description: '', category: 'sonstiges', amount: inv.totalAmount ?? 0 }]
}

/** Summen pro Jahr und Währung, aufgeteilt nach Kategorie der Positionen; Rechnungen ohne Positionen zählen als «sonstiges». */
export function costsByYear(invoices: Invoice[], opts?: CurrencyOptions): YearCosts[] {
  const map = new Map<string, YearCosts>()
  for (const inv of invoices) {
    const year = yearOf(inv.date)
    const p = price(inv, opts)
    const key = `${year}|${p.currency}`
    let row = map.get(key)
    if (!row) {
      row = { year, currency: p.currency, total: 0, byCategory: {}, converted: 0, unconverted: 0 }
      map.set(key, row)
    }
    for (const item of itemsOf(inv)) {
      const cat = item.category || 'sonstiges'
      row.byCategory[cat] = round2((row.byCategory[cat] ?? 0) + round2((item.amount ?? 0) * p.factor))
    }
    row.total = round2(row.total + round2((inv.totalAmount ?? 0) * p.factor))
    if (p.converted)
      row.converted++
    if (p.unconverted)
      row.unconverted++
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

export interface FleetRow {
  vehicleId: string
  vehicle: string
  year: number
  currency: string
  total: number
}

/** Kosten pro Fahrzeug und Jahr über den ganzen Fuhrpark; neuestes Jahr zuerst, innerhalb des Jahres alphabetisch. */
export function fleetCostsByVehicleYear(vehicles: (VehicleInfo & { id: string })[], invoices: Invoice[], opts?: CurrencyOptions): FleetRow[] {
  const rows: FleetRow[] = []
  for (const v of vehicles) {
    const label = `${v.make} ${v.model} · ${v.licensePlate}`
    for (const yc of costsByYear(invoices.filter(i => i.vehicleId === v.id), opts))
      rows.push({ vehicleId: v.id, vehicle: label, year: yc.year, currency: yc.currency, total: yc.total })
  }
  return rows.sort((a, b) => b.year - a.year || a.vehicle.localeCompare(b.vehicle) || a.currency.localeCompare(b.currency))
}

function csvCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null)
    return ''
  const s = String(value)
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Eine Zeile pro Rechnungsposition, Semikolon-getrennt mit BOM, damit Excel (de-CH) die Datei direkt richtig öffnet.
 * Mit `opts` kommen die Spalten «Betrag <Heimwährung>» und «Kurs» dazu (leer, wenn kein Kurs vorliegt).
 */
export function invoicesToCsv(invoices: Invoice[], vehicle: VehicleInfo, opts?: CurrencyOptions): string {
  return invoicesToCsvRows(invoices.map(inv => ({ inv, vehicle })), opts)
}

export function invoicesToCsvRows(entries: { inv: Invoice, vehicle: VehicleInfo }[], opts?: CurrencyOptions): string {
  const header = ['Fahrzeug', 'Kennzeichen', 'Datum', 'Werkstatt', 'Kilometerstand', 'Kategorie', 'Beschreibung', 'Betrag', 'Währung']
  if (opts)
    header.push(`Betrag ${opts.homeCurrency}`, 'Kurs')
  const rows: string[][] = []
  const sorted = [...entries].sort((a, b) => a.inv.date.localeCompare(b.inv.date))
  for (const { inv, vehicle } of sorted) {
    const p = price(inv, opts)
    for (const item of itemsOf(inv)) {
      const row = [
        `${vehicle.make} ${vehicle.model}`,
        vehicle.licensePlate,
        inv.date,
        inv.workshopName ?? '',
        inv.mileageAtService === undefined || inv.mileageAtService === null ? '' : String(inv.mileageAtService),
        categoryLabel(item.category || 'sonstiges'),
        item.description ?? '',
        (item.amount ?? 0).toFixed(2),
        inv.currency || DEFAULT_CURRENCY,
      ]
      if (opts) {
        row.push(
          p.unconverted ? '' : round2((item.amount ?? 0) * p.factor).toFixed(2),
          p.unconverted ? '' : String(p.factor),
        )
      }
      rows.push(row)
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
