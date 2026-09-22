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
 * Das Total steht am Schluss: nennt eine Fortsetzung eines, gilt es, auch wenn die erste Seite schon einen Betrag
 * hatte. Mistral setzt auf einer Kopfseite ohne Total gern die Summe der Positionen dieser Seite ein
 * (testdateien/test-rechnungen-sammel.pdf: 561.00 statt 1'395.55).
 * Hält Mistral eine Fortsetzung für eine neue Rechnung, trägt sie oft Werkstatt und Datum der Vorseite: gleiche
 * Werkstatt und gleiches Datum wie die direkt vorherige Seite gelten darum als Fortsetzung, ausser der Betrag ist
 * auch gleich (doppelt eingescannte Seite). Umgekehrt beginnt eine «Fortsetzung» mit anderer Werkstatt eine neue
 * Rechnung; auch das kam im Sammel-PDF vor.
 */
export function mergePdfPages(pages: { page: number, kind: PageKind, parsed: ParsedInvoice }[]): (ParsedInvoice & { pages: number[] })[] {
  const result: (ParsedInvoice & { pages: number[] })[] = []
  const same = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()
  for (const { page, kind, parsed } of pages) {
    if (kind === 'andere')
      continue
    const prev = result[result.length - 1]
    const repeatsPrev = kind === 'rechnung' && !!prev && prev.pages[prev.pages.length - 1] === page - 1
      && same(parsed.workshopName, prev.workshopName) && same(parsed.date, prev.date)
      // gleicher Betrag: dieselbe Rechnung doppelt eingescannt, das meldet buildBatch als «doppelt im Beleg»
      && parsed.totalAmount !== prev.totalAmount
    // umgekehrt: eine «Fortsetzung» mit anderer Werkstatt als die Vorseite ist eine neue Rechnung
    const otherWorkshop = !!parsed.workshopName?.trim() && !!prev?.workshopName?.trim() && !same(parsed.workshopName, prev.workshopName)
    if (((kind === 'fortsetzung' && !otherWorkshop) || repeatsPrev) && prev) {
      prev.pages.push(page)
      prev.items = [...prev.items, ...(parsed.items ?? [])]
      if (parsed.totalAmount)
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
  /** Zielfahrzeug: per Kontrollschild erkannt, sonst das offene Fahrzeug; in der Prüfliste änderbar */
  vehicleId?: string
  /** Hinweis zum Kontrollschild auf dem Beleg, z. B. andere Zuordnung oder unbekannt */
  plateNote: string | null
}

export interface BatchVehicle {
  id: string
  licensePlate?: string
  make: string
  model: string
}

export function normalizePlate(plate: string | null | undefined): string {
  return (plate ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^CH(?=[A-Z]{2}\d)/, '')
}

export function plateAssignment(plate: string | null | undefined, vehicles: BatchVehicle[], currentVehicleId?: string): { vehicleId?: string, note: string | null, unknown: boolean } {
  const key = normalizePlate(plate)
  if (!key || !vehicles.length)
    return { vehicleId: currentVehicleId, note: null, unknown: false }
  const match = vehicles.find(v => normalizePlate(v.licensePlate) === key)
  const shown = (plate ?? '').trim().toUpperCase().replace(/\s+/g, ' ')
  if (!match)
    return { vehicleId: currentVehicleId, note: `Kontrollschild ${shown} gehört zu keinem Fahrzeug`, unknown: true }
  if (match.id === currentVehicleId)
    return { vehicleId: match.id, note: null, unknown: false }
  return { vehicleId: match.id, note: `Kontrollschild ${match.licensePlate}: ${match.make} ${match.model}`, unknown: false }
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
  existing: { vehicleId?: string, date: string, totalAmount?: number }[],
  opts: { vehicles?: BatchVehicle[], currentVehicleId?: string } = {},
): BatchEntry[] {
  const known = existing.filter(e => e.totalAmount).map(e => ({ vehicleId: e.vehicleId, date: e.date, amount: e.totalAmount! }))
  const seen: { vehicleId?: string, date: string, amount: number }[] = []
  // ohne vehicleId (z. B. nur Rechnungen des offenen Fahrzeugs übergeben) zählt jede bekannte Rechnung
  const sameVehicle = (a?: string, b?: string) => !a || !b || a === b
  return scanned.map(({ parsed, source, imageBase64 }) => {
    const assignment = plateAssignment(parsed.licensePlate, opts.vehicles ?? [], opts.currentVehicleId)
    const draft = draftFromParsed(parsed)
    if (!draft)
      return { source, draft: null, duplicate: null, selected: false, imageBase64, vehicleId: assignment.vehicleId, plateNote: assignment.note }
    const self = { vehicleId: assignment.vehicleId, date: draft.date, amount: draft.totalAmount }
    const duplicate = known.some(k => sameVehicle(k.vehicleId, self.vehicleId) && sameInvoice(k, self))
      ? 'bereits erfasst' as const
      : seen.some(s => sameVehicle(s.vehicleId, self.vehicleId) && sameInvoice(s, self)) ? 'doppelt im Beleg' as const : null
    seen.push(self)
    return {
      source,
      draft,
      duplicate,
      selected: duplicate === null && !assignment.unknown,
      imageBase64,
      vehicleId: assignment.vehicleId,
      plateNote: assignment.note,
    }
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
