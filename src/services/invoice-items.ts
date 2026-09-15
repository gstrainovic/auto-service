/**
 * Nachkontrolle erkannter Rechnungspositionen, unabhängig von der KI.
 *
 * Typischer Fehler: mehrere Beschreibungszeilen gehören zu EINER Arbeitszeile mit Betrag («Auspuff reparieren»,
 * «Auto auf Ölverlust kontrollieren», «Arbeit 1.50 Std. 195.00»), die KI hängt den Betrag an jede Zeile. Erkennbar
 * daran, dass die Positionen zusammen mehr ergeben als die ganze Rechnung. Dann werden aufeinanderfolgende Positionen
 * mit gleichem Betrag zusammengefasst, aber nur, wenn die Summe danach passt.
 */
import { normalizeCurrency } from '../lib/locale'
import { MAINTENANCE_CATEGORIES } from './categories'
import { correctCategory } from './category-correction'

export interface ItemLike {
  description: string
  category: string
  amount: number
}

/** Rundung und Rabatte: bis 1 Franken über dem Total gilt als stimmig */
const TOLERANCE = 1

const cents = (n: number) => Math.round(n * 100) / 100

function sum(items: { amount: number }[]): number {
  return cents(items.reduce((s, i) => s + (i.amount || 0), 0))
}

export function itemsExceedTotal(items: { amount: number }[], total: number): { itemsSum: number, total: number } | null {
  if (!items.length || !total)
    return null
  const itemsSum = sum(items)
  return itemsSum > total + TOLERANCE ? { itemsSum, total } : null
}

const COLLECTIVE = /^(?:arbeit(?:en|szeit)?|arbeitsstunden|montage|lohn)$/i

function mergeRun<T extends ItemLike>(run: T[]): T {
  const collective = run.find(i => COLLECTIVE.test(i.description.trim()))
  const details = run.filter(i => i !== collective).map(i => i.description.trim()).filter(Boolean)
  const description = collective ? `${collective.description.trim()}: ${details.join(', ')}` : details.join(', ')
  const fallback = run.find(i => i.category && i.category !== 'sonstiges')?.category ?? run[0]!.category
  return { ...run[0]!, description, category: correctCategory(description, fallback), amount: run[0]!.amount }
}

/** Neuer Fahrzeug-Kilometerstand aus einem Beleg oder einer Wartung, nur wenn er höher ist als der bekannte */
export function newVehicleMileage(current: number | null | undefined, reported: number | null | undefined): number | undefined {
  return reported && reported > (current || 0) ? reported : undefined
}

export interface InvoiceSaveInput {
  vehicleId: string
  workshopName: string
  date: string
  totalAmount: number
  currency?: string
  mileageAtService?: number | null
  items: ItemLike[]
}

export interface InvoiceSavePlan {
  invoice: Omit<InvoiceSaveInput, 'currency' | 'mileageAtService'> & { currency: string, mileageAtService: number | null }
  maintenances: { type: string, description: string, doneAt: string, mileageAtService: number | null }[]
  /** neuer Fahrzeug-Kilometerstand, nur wenn der Beleg einen höheren nennt */
  vehicleMileage?: number
}

/**
 * Was beim Speichern einer Rechnung passiert, für Chat, Formular und Stapel gleich: Kategorien normieren und per
 * Stichwort korrigieren, Positionen gegen das Total prüfen, eine Wartung pro Kategorie, Kilometerstand nachziehen.
 */
export function planInvoiceSave(input: InvoiceSaveInput, vehicle: { mileage?: number | null }): InvoiceSavePlan {
  const normalized = input.items.map((item) => {
    const cat = (item.category || '').toLowerCase().trim()
    const aiCategory = (MAINTENANCE_CATEGORIES as readonly string[]).includes(cat) ? cat : 'sonstiges'
    return { ...item, category: correctCategory(item.description, aiCategory) }
  })
  const { items } = repairItems(normalized, input.totalAmount)
  const mileage = input.mileageAtService && input.mileageAtService > 0 ? input.mileageAtService : null
  const vehicleMileage = newVehicleMileage(vehicle.mileage, mileage)
  return {
    invoice: { ...input, currency: normalizeCurrency(input.currency), mileageAtService: mileage, items },
    maintenances: maintenancesFromItems(items).map(m => ({ type: m.category, description: m.description, doneAt: input.date, mileageAtService: mileage })),
    ...(vehicleMileage ? { vehicleMileage } : {}),
  }
}

/** Wartungseinträge aus Positionen: einer pro Kategorie, Beschreibungen verbunden, Reihenfolge der Rechnung */
export function maintenancesFromItems(items: ItemLike[]): { category: string, description: string }[] {
  const byCategory = new Map<string, string[]>()
  for (const item of items) {
    const list = byCategory.get(item.category) ?? []
    if (item.description.trim())
      list.push(item.description.trim())
    byCategory.set(item.category, list)
  }
  return [...byCategory].map(([category, descriptions]) => ({ category, description: descriptions.join(', ') }))
}

export function repairItems<T extends ItemLike>(items: T[], total: number): { items: T[], repaired: boolean } {
  if (!itemsExceedTotal(items, total))
    return { items, repaired: false }

  const merged: T[] = []
  let i = 0
  while (i < items.length) {
    let j = i + 1
    while (j < items.length && cents(items[j]!.amount) === cents(items[i]!.amount) && items[i]!.amount > 0)
      j++
    merged.push(j - i > 1 ? mergeRun(items.slice(i, j)) : items[i]!)
    i = j
  }

  if (merged.length === items.length || itemsExceedTotal(merged, total))
    return { items, repaired: false }
  return { items: merged, repaired: true }
}
