/**
 * Wartung ohne Rechnung speichern (Formular, «Erledigt eintragen», letzte Wartungen nach dem Anlegen): Eintrag und,
 * bei erledigten Arbeiten, höherer Kilometerstand am Fahrzeug in einer Transaktion.
 */
import { getCurrentUserId } from '../composables/useAuth'
import { db, id, tx } from '../lib/instantdb'
import { newVehicleMileage } from './invoice-items'

export interface MaintenanceInput {
  vehicleId: string
  type: string
  description?: string
  doneAt: string
  mileageAtService?: number | null
  status: 'done' | 'due' | 'overdue'
}

export async function saveMaintenances(entries: MaintenanceInput[]): Promise<void> {
  if (!entries.length)
    return
  // Offline beantwortet InstantDB keine Abfrage; dann werden nur die Wartungen geschrieben
  let vehicles: any[] = []
  try {
    vehicles = (await db.queryOnce({ vehicles: {} })).data.vehicles || []
  }
  catch {}
  const now = new Date().toISOString()
  const creatorId = getCurrentUserId()
  const transactions: any[] = entries.map(e => (tx.maintenances as any)[id()].update({
    ...e,
    description: e.description ?? '',
    mileageAtService: e.mileageAtService || null,
    creatorId,
    createdAt: now,
    updatedAt: now,
  }))
  // pro Fahrzeug den höchsten gemeldeten Stand einer erledigten Arbeit übernehmen
  for (const v of vehicles) {
    const reported = Math.max(0, ...entries.filter(e => e.vehicleId === v.id && e.status === 'done').map(e => e.mileageAtService || 0))
    const mileage = newVehicleMileage(v.mileage, reported)
    if (mileage)
      transactions.push((tx.vehicles as any)[v.id].update({ mileage, updatedAt: now }))
  }
  await db.transact(transactions)
}
