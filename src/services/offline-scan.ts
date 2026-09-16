import type { Invoice } from '../stores/invoices'
/**
 * Offline fotografierte Belege: Ohne Verbindung läuft kein KI-Scan. Der Beleg wird trotzdem gespeichert und mit
 * `scanPending` markiert; sobald das Gerät wieder online ist, holt `useOfflineScanQueue` den Scan nach und füllt
 * die leeren Felder. Von Hand eingetragene Werte bleiben unangetastet.
 */
import type { ParsedInvoice } from './ai'
import { scannedToFormFields } from './invoice-scan'

export type PendingUpdate = Partial<Pick<Invoice, 'workshopName' | 'date' | 'totalAmount' | 'currency' | 'mileageAtService' | 'items'>> & { scanPending: false }

export function pendingScans(invoices: Invoice[]): Invoice[] {
  return invoices.filter(i => i.scanPending && i.imageData)
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '' || value === 0 || (Array.isArray(value) && value.length === 0)
}

/** Änderungen für den Beleg: nur leere Felder werden gefüllt, die Markierung fällt in jedem Fall weg */
export function mergeScanIntoInvoice(invoice: Invoice, parsed: ParsedInvoice): PendingUpdate {
  const fields = scannedToFormFields(parsed)
  const update: PendingUpdate = { scanPending: false }
  if (isEmpty(invoice.workshopName) && fields.workshop)
    update.workshopName = fields.workshop
  if (isEmpty(invoice.date) && fields.date)
    update.date = fields.date
  if (isEmpty(invoice.totalAmount) && fields.amount)
    update.totalAmount = fields.amount
  if (isEmpty(invoice.currency) && fields.currency)
    update.currency = fields.currency
  if (isEmpty(invoice.mileageAtService) && fields.mileage)
    update.mileageAtService = fields.mileage
  if (isEmpty(invoice.items) && fields.items?.length)
    update.items = fields.items
  return update
}
