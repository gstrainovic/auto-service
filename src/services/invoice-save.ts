/**
 * Rechnung speichern, für Chat, Formular, Foto-Stapel und Sammel-PDF derselbe Weg: Rechnung, eine Wartung pro
 * Kategorie (mit invoiceId, damit Löschen und Bearbeiten sie mitnehmen) und höherer Kilometerstand am Fahrzeug,
 * alles in einer Transaktion. Die Regeln stehen in planInvoiceSave (invoice-items.ts, getestet).
 */
import type { InvoiceSaveInput, InvoiceSavePlan } from './invoice-items'
import { getCurrentUserId } from '../composables/useAuth'
import { db, id, tx } from '../lib/instantdb'
import { planInvoiceSave } from './invoice-items'

export async function saveInvoice(input: InvoiceSaveInput & { imageData?: string, ocrCacheId?: string }): Promise<{ invoiceId: string, plan: InvoiceSavePlan }> {
  const { imageData, ocrCacheId, ...data } = input
  const result = await db.queryOnce({ vehicles: {} })
  const vehicle = (result.data.vehicles || []).find((v: any) => v.id === data.vehicleId) ?? {}
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
