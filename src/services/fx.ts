/**
 * Wechselkurse für gemischte Währungen (Grenzregion: EUR-Rechnungen bei CHF-Konto).
 * Quelle: EZB-Referenzkurse über Frankfurter (api.frankfurter.dev, ohne Schlüssel, CORS), Kurs zum
 * Rechnungsdatum; an Wochenenden liefert Frankfurter den letzten Handelstag. Kurse vergangener Tage
 * ändern sich nicht, deshalb Cache im localStorage. Ohne Kurs (offline, unbekannte Währung) bleibt
 * der Betrag in der Originalwährung stehen, nie stillschweigend falsch.
 */
import type { Invoice } from '../stores/invoices'
import { DEFAULT_CURRENCY } from '../lib/locale'

export type RateMap = Map<string, number>
type FetchFn = (url: string) => Promise<Response>

export function rateKey(from: string, to: string, date: string): string {
  return `${from}|${to}|${date}`
}

const memory: RateMap = new Map()

/** Nur für Tests: In-Memory-Cache leeren. */
export function clearRateCache(): void {
  memory.clear()
}

function readCache(key: string): number | undefined {
  if (memory.has(key))
    return memory.get(key)
  try {
    const v = localStorage.getItem(`fx:${key}`)
    if (v !== null) {
      const n = Number(v)
      memory.set(key, n)
      return n
    }
  }
  catch {}
  return undefined
}

function writeCache(key: string, rate: number): void {
  memory.set(key, rate)
  try {
    localStorage.setItem(`fx:${key}`, String(rate))
  }
  catch {}
}

export async function fetchRate(from: string, to: string, date: string, fetchFn: FetchFn = url => fetch(url)): Promise<number | undefined> {
  if (from === to)
    return 1
  const key = rateKey(from, to, date)
  const cached = readCache(key)
  if (cached !== undefined)
    return cached
  try {
    const res = await fetchFn(`https://api.frankfurter.dev/v1/${date}?base=${from}&symbols=${to}`)
    if (!res.ok)
      return undefined
    const data = await res.json() as { rates?: Record<string, number> }
    const rate = data.rates?.[to]
    if (typeof rate !== 'number')
      return undefined
    writeCache(key, rate)
    return rate
  }
  catch {
    return undefined
  }
}

export function convert(amount: number, from: string, to: string, date: string, rates: RateMap): number | undefined {
  if (from === to)
    return amount
  const rate = rates.get(rateKey(from, to, date))
  if (rate === undefined)
    return undefined
  return Math.round(amount * rate * 100) / 100
}

/** Kurse für alle fremden Währungen der Rechnungen holen; was fehlschlägt, fehlt in der Map. */
export async function resolveRates(invoices: Invoice[], homeCurrency: string, fetchFn?: FetchFn): Promise<RateMap> {
  const rates: RateMap = new Map()
  const wanted = new Map<string, [string, string]>()
  for (const inv of invoices) {
    const currency = inv.currency || DEFAULT_CURRENCY
    if (currency !== homeCurrency && inv.date)
      wanted.set(rateKey(currency, homeCurrency, inv.date), [currency, inv.date])
  }
  await Promise.all([...wanted].map(async ([key, [currency, date]]) => {
    const rate = await fetchRate(currency, homeCurrency, date, fetchFn)
    if (rate !== undefined)
      rates.set(key, rate)
  }))
  return rates
}
