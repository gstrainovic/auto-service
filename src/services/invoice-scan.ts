/**
 * Beleg-Scan im Rechnungsformular: Foto ausrichten, per OCR lesen, Felder vorbefüllen. Dieselbe KI-Pipeline wie der
 * Chat (ai.ts: Mistral OCR, dann strukturierte Auswertung); die reinen Abbildungsfunktionen sind hier getestet.
 */
import type { InvoiceFormData, InvoiceFormItem } from '../types/forms'
import type { ParsedInvoice } from './ai'
import { normalizeCurrency } from '../lib/locale'
import { correctCategory } from './category-correction'

export type ScannedFields = Partial<Pick<InvoiceFormData, 'workshop' | 'date' | 'amount' | 'currency' | 'mileage' | 'items'>>

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function scannedToFormFields(parsed: ParsedInvoice): ScannedFields {
  const fields: ScannedFields = {}
  if (parsed.workshopName?.trim())
    fields.workshop = parsed.workshopName.trim()
  if (ISO_DATE.test(parsed.date ?? ''))
    fields.date = parsed.date
  if (parsed.totalAmount > 0)
    fields.amount = parsed.totalAmount
  const currency = normalizeCurrency(parsed.currency)
  if (currency === 'CHF' || currency === 'EUR')
    fields.currency = currency
  if (parsed.mileageAtService && parsed.mileageAtService > 0)
    fields.mileage = parsed.mileageAtService
  const items: InvoiceFormItem[] = (parsed.items ?? []).map(i => ({
    description: i.description,
    category: correctCategory(i.description, i.category) as InvoiceFormItem['category'],
    amount: i.amount,
  }))
  if (items.length)
    fields.items = items
  return fields
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)
}

/** Füllt nur leere Formularfelder; die Währung nur, solange der Nutzer sie nicht selbst umgestellt hat. */
export function fillEmptyFields<T extends Partial<InvoiceFormData>>(current: T, scanned: ScannedFields, opts: { currencyTouched: boolean }): T & ScannedFields {
  const merged: T & ScannedFields = { ...current }
  for (const key of ['workshop', 'date', 'amount', 'mileage', 'items'] as const) {
    if (isEmpty(merged[key]) && !isEmpty(scanned[key]))
      (merged as Partial<InvoiceFormData>)[key] = scanned[key] as never
  }
  if (scanned.currency && !opts.currencyTouched)
    merged.currency = scanned.currency
  return merged
}
