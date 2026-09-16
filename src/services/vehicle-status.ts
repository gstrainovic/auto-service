/**
 * Verkauft oder abgegeben statt gelöscht. Löschen nimmt Rechnungen und Wartungen mit; die Kosten fehlen dann im
 * Jahresabschluss und die Belege sind weg (Aufbewahrungspflicht, OR Art. 958f). Ein verkauftes Fahrzeug verschwindet
 * aus Fälligkeiten und Erinnerungen, bleibt aber in Kosten, Exporten und Dossier.
 */
import { formatDate, formatNumber } from '../lib/locale'

export interface SellableVehicle {
  make: string
  model: string
  /** Tag der Übergabe (ISO). Ein Datum in der Zukunft heisst: gehört bis dahin noch zur Flotte. */
  soldAt?: string | null
  soldMileage?: number | null
}

const todayIso = () => new Date().toISOString().slice(0, 10)

export function isSold(vehicle: SellableVehicle, today: string = todayIso()): boolean {
  return !!vehicle.soldAt && vehicle.soldAt <= today
}

export function activeVehicles<T extends SellableVehicle>(vehicles: T[], today: string = todayIso()): T[] {
  return vehicles.filter(v => !isSold(v, today))
}

export function soldVehicles<T extends SellableVehicle>(vehicles: T[], today: string = todayIso()): T[] {
  return vehicles.filter(v => isSold(v, today))
}

/** Vermerk für Karte, Kopfzeile und Dossier; vor der Übergabe «Übergabe am …» */
export function soldLabel(vehicle: SellableVehicle, today: string = todayIso()): string {
  if (!vehicle.soldAt)
    return ''
  const when = formatDate(vehicle.soldAt)
  if (!isSold(vehicle, today))
    return `Übergabe am ${when}`
  return vehicle.soldMileage ? `Verkauft am ${when} bei ${formatNumber(vehicle.soldMileage)} km` : `Verkauft am ${when}`
}
