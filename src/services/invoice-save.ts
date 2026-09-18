/**
 * Rechnung speichern, für Chat, Formular, Foto-Stapel und Sammel-PDF derselbe Weg: Rechnung, eine Wartung pro
 * Kategorie (mit invoiceId, damit Löschen und Bearbeiten sie mitnehmen) und höherer Kilometerstand am Fahrzeug,
 * alles in einer Transaktion. Die Regeln stehen in planInvoiceSave (invoice-items.ts, getestet).
 */
import type { EntrySource } from './entry-source'
import type { InvoiceSaveInput, InvoiceSavePlan, InvoiceUpdatePlan } from './invoice-items'
import { getCurrentUserId } from '../composables/useAuth'
import { db, id, tx } from '../lib/instantdb'
import { planInvoiceSave, planInvoiceUpdate } from './invoice-items'

/** Abfrage, die offline leer zurückkommt statt zu scheitern */
async function queryOrEmpty(query: Record<string, any>): Promise<Record<string, any[]>> {
  try {
    const result = await db.queryOnce(query as any)
    return (result.data ?? {}) as Record<string, any[]>
  }
  catch {
    return {}
  }
}

async function findVehicle(vehicleId: string): Promise<{ mileage?: number | null }> {
  const { vehicles } = await queryOrEmpty({ vehicles: {} })
  return (vehicles || []).find((v: any) => v.id === vehicleId) ?? {}
}

export async function saveInvoice(input: InvoiceSaveInput & { imageData?: string, ocrCacheId?: string, scanPending?: boolean }, source: EntrySource): Promise<{ invoiceId: string, plan: InvoiceSavePlan }> {
  const { imageData, ocrCacheId, scanPending, ...data } = input
  // Offline beantwortet InstantDB keine Abfrage; dann wird ohne Fahrzeugdaten gespeichert und der
  // Kilometerstand bleibt, wie er ist.
  const vehicle = await findVehicle(data.vehicleId)
  const plan = planInvoiceSave(data, vehicle)

  const now = new Date().toISOString()
  const creatorId = getCurrentUserId()
  const invoiceId = id()
  // JSON-Kopie: Vue-Proxies aus Formularen lassen sich nicht in IndexedDB klonen
  const invoice = JSON.parse(JSON.stringify(plan.invoice))
  const transactions: any[] = [
    (tx.invoices as any)[invoiceId].update({
      ...invoice,
      ...(imageData ? { imageData } : {}),
      ...(ocrCacheId ? { ocrCacheId } : {}),
      ...(scanPending ? { scanPending: true } : {}),
      source,
      creatorId,
      createdAt: now,
      updatedAt: now,
    }),
    ...plan.maintenances.map(m => (tx.maintenances as any)[id()].update({
      ...m,
      vehicleId: data.vehicleId,
      invoiceId,
      nextDueDate: '',
      nextDueMileage: 0,
      status: 'done',
      source,
      creatorId,
      createdAt: now,
      updatedAt: now,
    })),
  ]
  if (plan.vehicleMileage)
    transactions.push((tx.vehicles as any)[data.vehicleId].update({ mileage: plan.vehicleMileage, updatedAt: now }))
  await db.transact(transactions)
  return { invoiceId, plan }
}

/**
 * Rechnung bearbeiten: Änderungen an Datum, Kilometerstand und Positionen gehen auch an die Wartungen, die aus
 * dieser Rechnung entstanden sind (`invoiceId`). Regeln in planInvoiceUpdate (invoice-items.ts, getestet).
 */
export async function updateInvoice(invoiceId: string, input: InvoiceSaveInput): Promise<InvoiceUpdatePlan> {
  const result = await queryOrEmpty({ vehicles: {}, maintenances: {} })
  const vehicle = (result.vehicles || []).find((v: any) => v.id === input.vehicleId) ?? {}
  const linked = ((result.maintenances || []) as any[]).filter(m => m.invoiceId === invoiceId)
  const plan = planInvoiceUpdate(input, linked, vehicle)
  const savePlan = planInvoiceSave(input, vehicle)

  const now = new Date().toISOString()
  const creatorId = getCurrentUserId()
  const transactions: any[] = [
    (tx.invoices as any)[invoiceId].update({
      ...JSON.parse(JSON.stringify(savePlan.invoice)),
      updatedAt: now,
    }),
    ...plan.updates.map(u => (tx.maintenances as any)[u.id].update({
      doneAt: u.doneAt,
      mileageAtService: u.mileageAtService,
      description: u.description,
      updatedAt: now,
    })),
    ...plan.creates.map(m => (tx.maintenances as any)[id()].update({
      ...m,
      vehicleId: input.vehicleId,
      invoiceId,
      nextDueDate: '',
      nextDueMileage: 0,
      status: 'done',
      // neue Position einer bestehenden Rechnung: Herkunft der Rechnung, abgelesen an ihren Wartungen
      source: linked.find(l => l.source)?.source ?? 'formular',
      creatorId,
      createdAt: now,
      updatedAt: now,
    })),
    ...plan.deletes.map(mId => (tx.maintenances as any)[mId].delete()),
  ]
  if (plan.vehicleMileage)
    transactions.push((tx.vehicles as any)[input.vehicleId].update({ mileage: plan.vehicleMileage, updatedAt: now }))
  await db.transact(transactions)
  return plan
}
