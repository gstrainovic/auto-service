/**
 * Fahrzeugausweis oder Kaufvertrag im Fahrzeugformular: erkannte Werte bereinigen und nur leere Felder füllen.
 * Reine Funktionen; Scan-Ablauf in composables/useVehicleScan.ts, KI-Schema in ai.ts (vehicleDocumentSchema).
 */
import type { ParsedVehicleDocument } from './ai'

export interface VehicleFields {
  make: string
  model: string
  year: number
  mileage: number
  licensePlate: string
  vin: string
}

/** Ausweise sind in Grossbuchstaben gedruckt: Wörter ab vier Buchstaben normal schreiben, Kürzel (BMW, VW, GTI) bleiben */
function readable(text: string): string {
  return text.trim().replace(/\s+/g, ' ').replace(/[A-ZÄÖÜ]{4,}/g, w => w[0] + w.slice(1).toLowerCase())
}

export function vehicleDocToFields(doc: ParsedVehicleDocument): Partial<VehicleFields> {
  const fields: Partial<VehicleFields> = {}
  if (doc.make?.trim())
    fields.make = readable(doc.make)
  if (doc.model?.trim())
    fields.model = readable(doc.model)
  const maxYear = new Date().getFullYear() + 1
  if (doc.year && doc.year >= 1886 && doc.year <= maxYear)
    fields.year = doc.year
  if (doc.mileage && doc.mileage > 0)
    fields.mileage = Math.round(doc.mileage)
  if (doc.plate?.trim())
    fields.licensePlate = doc.plate.trim().replace(/\s+/g, ' ').toUpperCase()
  if (doc.vin?.trim()) {
    const compact = doc.vin.replace(/\s+/g, '').toUpperCase()
    // 17-stellige VIN ohne Leerzeichen; ältere Fahrgestellnummern (z. B. «2 100 728») wie gedruckt
    fields.vin = compact.length === 17 ? compact : doc.vin.trim().replace(/\s+/g, ' ')
  }
  return fields
}

export function fillVehicleFields<T extends VehicleFields>(current: T, scanned: Partial<VehicleFields>, opts: { yearTouched: boolean }): T {
  const merged = { ...current }
  for (const key of ['make', 'model', 'licensePlate', 'vin'] as const) {
    if (!merged[key]?.trim() && scanned[key])
      merged[key] = scanned[key]!
  }
  if (!merged.mileage && scanned.mileage)
    merged.mileage = scanned.mileage
  if (!opts.yearTouched && scanned.year)
    merged.year = scanned.year
  return merged
}
