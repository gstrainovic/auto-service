import type { Invoice } from '../stores/invoices'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearRateCache, convert, fetchRate, rateKey, resolveRates } from './fx'

// Wechselkurse der EZB über Frankfurter (api.frankfurter.dev), gecacht pro Währungspaar und Datum

const store = new Map<string, string>()
const localStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v) },
  removeItem: (k: string) => { store.delete(k) },
}

beforeEach(() => {
  store.clear()
  clearRateCache()
  vi.stubGlobal('localStorage', localStorageMock)
})

describe('fetchRate', () => {
  it('liest den Kurs aus der Frankfurter-Antwort und cacht ihn', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ amount: 1, base: 'EUR', date: '2026-05-20', rates: { CHF: 0.9165 } })))
    expect(await fetchRate('EUR', 'CHF', '2026-05-20', fetchFn)).toBe(0.9165)
    expect(fetchFn).toHaveBeenCalledWith('https://api.frankfurter.dev/v1/2026-05-20?base=EUR&symbols=CHF')
    expect(await fetchRate('EUR', 'CHF', '2026-05-20', fetchFn)).toBe(0.9165)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('gibt undefined zurück, wenn die Quelle nicht erreichbar ist', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('offline')
    })
    expect(await fetchRate('EUR', 'CHF', '2026-05-20', fetchFn)).toBeUndefined()
  })

  it('braucht für die eigene Währung keinen Kurs', async () => {
    const fetchFn = vi.fn()
    expect(await fetchRate('CHF', 'CHF', '2026-05-20', fetchFn)).toBe(1)
    expect(fetchFn).not.toHaveBeenCalled()
  })
})

describe('convert und resolveRates', () => {
  it('rechnet mit dem Kurs zum Rechnungsdatum um, auf Rappen gerundet', () => {
    const rates = new Map([[rateKey('EUR', 'CHF', '2026-05-20'), 0.9165]])
    expect(convert(120, 'EUR', 'CHF', '2026-05-20', rates)).toBe(109.98)
    expect(convert(120, 'CHF', 'CHF', '2026-05-20', rates)).toBe(120)
    expect(convert(120, 'USD', 'CHF', '2026-05-20', rates)).toBeUndefined()
  })

  it('holt nur Kurse für fremde Währungen und ignoriert Fehler', async () => {
    const invoices = [
      { id: 'a', vehicleId: 'v', date: '2026-05-20', currency: 'EUR', totalAmount: 120, createdAt: '', updatedAt: '' },
      { id: 'b', vehicleId: 'v', date: '2026-05-20', currency: 'CHF', totalAmount: 50, createdAt: '', updatedAt: '' },
      { id: 'c', vehicleId: 'v', date: '2026-06-01', currency: 'USD', totalAmount: 10, createdAt: '', updatedAt: '' },
    ] as Invoice[]
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes('base=USD'))
        throw new Error('offline')
      return new Response(JSON.stringify({ rates: { CHF: 0.9165 } }))
    })
    const rates = await resolveRates(invoices, 'CHF', fetchFn)
    expect(rates.get(rateKey('EUR', 'CHF', '2026-05-20'))).toBe(0.9165)
    expect(rates.has(rateKey('USD', 'CHF', '2026-06-01'))).toBe(false)
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })
})
