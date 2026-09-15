/**
 * Beleg-Scan im Rechnungsformular: Foto ausrichten, per OCR lesen, Felder vorbefüllen. Dieselbe KI-Pipeline wie der
 * Chat (ai.ts: Mistral OCR, dann strukturierte Auswertung); die reinen Abbildungsfunktionen sind hier getestet.
 */
import type { InvoiceFormData, InvoiceFormItem } from '../types/forms'
import type { ParsedInvoice } from './ai'
import { normalizeCurrency } from '../lib/locale'
import { correctCategory } from './category-correction'
import { repairItems } from './invoice-items'

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
  const corrected: InvoiceFormItem[] = (parsed.items ?? []).map(i => ({
    description: i.description,
    category: correctCategory(i.description, i.category) as InvoiceFormItem['category'],
    amount: i.amount,
  }))
  // Positionen, die sich einen Arbeitsbetrag teilen, zusammenfassen (Summe sonst über dem Total)
  const { items } = repairItems(corrected, parsed.totalAmount)
  if (items.length)
    fields.items = items
  return fields
}

/** Speicherbare Rechnung aus einem Scan; ohne gültiges Datum oder Betrag null (dann nur als Hinweis anzeigen) */
export interface InvoiceDraft {
  workshopName: string
  date: string
  totalAmount: number
  currency: string
  mileageAtService?: number
  items: InvoiceFormItem[]
}

export function draftFromParsed(parsed: ParsedInvoice): InvoiceDraft | null {
  const fields = scannedToFormFields(parsed)
  if (!fields.date || !fields.amount)
    return null
  return {
    workshopName: fields.workshop ?? '',
    date: fields.date,
    totalAmount: fields.amount,
    currency: normalizeCurrency(parsed.currency),
    ...(fields.mileage ? { mileageAtService: fields.mileage } : {}),
    items: fields.items ?? [],
  }
}

export type PageKind = 'rechnung' | 'fortsetzung' | 'andere'

/**
 * PDF-Seiten einzeln ausgewertet → Rechnungen. Eine Seite mit eigenem Rechnungskopf beginnt eine Rechnung,
 * eine Fortsetzung (Übertrag, Abrechnungsdetails) ergänzt die vorherige, andere Seiten (AGB, leer) fallen weg.
 */
export function mergePdfPages(pages: { page: number, kind: PageKind, parsed: ParsedInvoice }[]): (ParsedInvoice & { pages: number[] })[] {
  const result: (ParsedInvoice & { pages: number[] })[] = []
  for (const { page, kind, parsed } of pages) {
    if (kind === 'andere')
      continue
    const prev = result[result.length - 1]
    if (kind === 'fortsetzung' && prev) {
      prev.pages.push(page)
      prev.items = [...prev.items, ...(parsed.items ?? [])]
      if (!prev.totalAmount && parsed.totalAmount)
        prev.totalAmount = parsed.totalAmount
      if (!prev.date && parsed.date)
        prev.date = parsed.date
      if (!prev.workshopName && parsed.workshopName)
        prev.workshopName = parsed.workshopName
      if (!prev.mileageAtService && parsed.mileageAtService)
        prev.mileageAtService = parsed.mileageAtService
      continue
    }
    result.push({ ...parsed, items: [...(parsed.items ?? [])], pages: [page] })
  }
  return result
}

export function pagesLabel(pages: number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b)
  if (!sorted.length)
    return 'PDF'
  if (sorted.length === 1)
    return `Seite ${sorted[0]}`
  const contiguous = sorted.every((p, i) => i === 0 || p === sorted[i - 1]! + 1)
  return contiguous ? `Seite ${sorted[0]}–${sorted[sorted.length - 1]}` : `Seiten ${sorted.join(', ')}`
}

export interface BatchEntry {
  /** Herkunft für die Anzeige, z. B. «Seite 1–2» oder Dateiname */
  source: string
  draft: InvoiceDraft | null
  duplicate: 'bereits erfasst' | 'doppelt im Beleg' | null
  selected: boolean
  /** ausgerichtetes Foto, nur bei Foto-Stapeln */
  imageBase64?: string
}

/**
 * Duplikat: gleicher Betrag auf den Rappen und Datum höchstens 14 Tage auseinander. Die Werkstatt schreibt die OCR
 * zu uneinheitlich, und Belege tragen oft Reparatur- und Rechnungsdatum, die je nach Scan verschieden gewählt werden.
 */
const DUPLICATE_DAYS = 14

function sameInvoice(a: { date: string, amount: number }, b: { date: string, amount: number }): boolean {
  if (Math.round(a.amount * 100) !== Math.round(b.amount * 100))
    return false
  const days = Math.abs(Date.parse(a.date) - Date.parse(b.date)) / 86_400_000
  return Number.isFinite(days) && days <= DUPLICATE_DAYS
}

export function buildBatch(
  scanned: { parsed: ParsedInvoice, source: string, imageBase64?: string }[],
  existing: { date: string, totalAmount?: number }[],
): BatchEntry[] {
  const known = existing.filter(e => e.totalAmount).map(e => ({ date: e.date, amount: e.totalAmount! }))
  const seen: { date: string, amount: number }[] = []
  return scanned.map(({ parsed, source, imageBase64 }) => {
    const draft = draftFromParsed(parsed)
    if (!draft)
      return { source, draft: null, duplicate: null, selected: false, imageBase64 }
    const self = { date: draft.date, amount: draft.totalAmount }
    const duplicate = known.some(k => sameInvoice(k, self))
      ? 'bereits erfasst' as const
      : seen.some(s => sameInvoice(s, self)) ? 'doppelt im Beleg' as const : null
    seen.push(self)
    return { source, draft, duplicate, selected: duplicate === null, imageBase64 }
  })
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
