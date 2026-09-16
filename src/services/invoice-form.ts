import type { InvoiceFormData } from '../types/forms'
/**
 * Formulardaten in die Eingabe von `saveInvoice` übersetzen. Dashboard und Fahrzeugseite nutzen dasselbe Formular,
 * darum steht die Umrechnung hier und nicht in den Seiten.
 */
import type { InvoiceSaveInput } from './invoice-items'
import { DEFAULT_CURRENCY } from '../lib/locale'

export function formToInvoiceInput(data: InvoiceFormData, vehicleId: string): InvoiceSaveInput & { imageData?: string, scanPending?: boolean } {
  return {
    vehicleId,
    workshopName: data.workshop ?? '',
    date: data.date,
    totalAmount: data.amount ?? 0,
    currency: data.currency || DEFAULT_CURRENCY,
    // Kilometerstand nur, wenn im Formular angegeben; der heutige Fahrzeugstand wäre bei alten Belegen falsch
    mileageAtService: data.mileage || undefined,
    // Positionen aus dem Beleg-Scan haben Vorrang; sonst eine Position aus Kategorie und Beschreibung
    items: data.items?.length
      ? data.items.map(i => ({ ...i }))
      : data.category
        ? [{ description: data.description || '', category: data.category, amount: data.amount || 0 }]
        : [],
    // InvoiceForm liefert das Foto als imageBase64
    imageData: data.images?.[0] ?? (data as { imageBase64?: string }).imageBase64,
    // offline fotografiert: der Scan wird nachgeholt, sobald wieder Verbindung besteht
    ...((data as { scanPending?: boolean }).scanPending ? { scanPending: true } : {}),
  }
}
