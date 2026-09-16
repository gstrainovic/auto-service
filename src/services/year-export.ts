/**
 * Jahresabschluss: alle Rechnungen eines Jahres als CSV plus die Belegbilder, zusammen in einem ZIP.
 * Das ist die Mappe für den Treuhänder und erfüllt die Aufbewahrungspflicht auch ausserhalb der App.
 */
import type { Invoice } from '../stores/invoices'
import type { CurrencyOptions, VehicleInfo } from './report'
import type { ZipFile } from './zip'
import { invoicesToCsvRows } from './report'

export interface YearExportInput {
  year: number
  vehicles: (VehicleInfo & { id: string })[]
  invoices: Invoice[]
  currency?: CurrencyOptions
}

/** Jahre mit Rechnungen, neuestes zuerst */
export function invoiceYears(invoices: Invoice[]): number[] {
  const years = new Set<number>()
  for (const inv of invoices) {
    const year = Number((inv.date || '').slice(0, 4))
    if (year)
      years.add(year)
  }
  return [...years].sort((a, b) => b - a)
}

/** Dateiname ohne Umlaute und Sonderzeichen, damit das Archiv auf jedem System lesbar bleibt */
function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++)
    bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** JPEG beginnt in base64 mit /9j/, alles andere ist bei uns WebP aus der Verkleinerung */
function imageExtension(base64: string): string {
  return base64.startsWith('/9j/') || base64.startsWith('data:image/jpeg') ? 'jpg' : 'webp'
}

export function yearExportFiles({ year, vehicles, invoices, currency }: YearExportInput): ZipFile[] {
  const byId = new Map(vehicles.map(v => [v.id, v]))
  const entries = invoices
    .filter(inv => inv.date?.startsWith(String(year)) && byId.has(inv.vehicleId))
    .map(inv => ({ inv, vehicle: byId.get(inv.vehicleId)! }))
    .sort((a, b) => a.inv.date.localeCompare(b.inv.date))
  if (!entries.length)
    return []

  const encoder = new TextEncoder()
  const files: ZipFile[] = [
    { name: `kosten-${year}.csv`, data: encoder.encode(invoicesToCsvRows(entries, currency)) },
  ]
  const used = new Set<string>()
  for (const { inv, vehicle } of entries) {
    if (!inv.imageData)
      continue
    const base = `belege/${inv.date}-${slug(`${vehicle.make} ${vehicle.model}`)}-${slug(inv.workshopName || 'beleg')}`
    let name = `${base}.${imageExtension(inv.imageData)}`
    let n = 2
    while (used.has(name))
      name = `${base}-${n++}.${imageExtension(inv.imageData)}`
    used.add(name)
    files.push({ name, data: base64ToBytes(inv.imageData) })
  }
  return files
}

export function yearExportFilename(year: number, _generatedAt: Date = new Date()): string {
  return `wartungsheft-jahresabschluss-${year}.zip`
}
