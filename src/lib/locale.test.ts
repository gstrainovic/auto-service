import { describe, expect, it } from 'vitest'
import { DEFAULT_CURRENCY, formatCurrency, formatNumber, normalizeCurrency } from './locale'

// Schweizer Standard: CHF, Apostroph als Tausendertrenner, Punkt als Dezimaltrenner
describe('locale', () => {
  it('standardwährung ist CHF', () => {
    expect(DEFAULT_CURRENCY).toBe('CHF')
  })

  it('formatiert Beträge im Schweizer Format mit CHF', () => {
    expect(formatCurrency(1234.5)).toBe('CHF 1\'234.50')
    expect(formatCurrency(0)).toBe('CHF 0.00')
    expect(formatCurrency(1234567.891)).toBe('CHF 1\'234\'567.89')
  })

  it('behält die Währung der Rechnung', () => {
    expect(formatCurrency(89.9, 'EUR')).toBe('EUR 89.90')
  })

  it('nimmt undefined als 0', () => {
    expect(formatCurrency(undefined)).toBe('CHF 0.00')
    expect(formatNumber(null)).toBe('0')
  })

  it('normalisiert Währungssymbole und Schreibweisen aus dem Scan auf ISO-Codes', () => {
    expect(normalizeCurrency('€')).toBe('EUR')
    expect(normalizeCurrency('EUR')).toBe('EUR')
    expect(normalizeCurrency('eur')).toBe('EUR')
    expect(normalizeCurrency('Euro')).toBe('EUR')
    expect(normalizeCurrency('CHF')).toBe('CHF')
    expect(normalizeCurrency('Fr.')).toBe('CHF')
    expect(normalizeCurrency('SFr.')).toBe('CHF')
    expect(normalizeCurrency('$')).toBe('USD')
    expect(normalizeCurrency(' chf ')).toBe('CHF')
    expect(normalizeCurrency(undefined)).toBe(DEFAULT_CURRENCY)
    expect(normalizeCurrency('')).toBe(DEFAULT_CURRENCY)
    expect(normalizeCurrency('XYZ')).toBe('XYZ')
  })

  it('formatiert Kilometer ohne Nachkommastellen', () => {
    expect(formatNumber(45000)).toBe('45\'000')
    expect(formatNumber(999)).toBe('999')
    expect(formatNumber(-1500)).toBe('-1\'500')
  })
})
