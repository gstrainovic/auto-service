import type { ParsedInvoice } from './ai'
import { describe, expect, it } from 'vitest'
import { fillEmptyFields, scannedToFormFields } from './invoice-scan'

const parsed: ParsedInvoice = {
  workshopName: 'Lucky Car Dornbirn',
  date: '2025-04-15',
  totalAmount: 1403.34,
  currency: '€',
  mileageAtService: 252586,
  licensePlate: 'SG 218574',
  items: [
    { description: 'Motoröl wechseln', category: 'inspektion', amount: 180 },
    { description: 'Auspuff reparieren', category: 'sonstiges', amount: 1100 },
  ],
}

describe('scannedToFormFields', () => {
  it('übernimmt Werkstatt, Datum, Betrag, Währung, Kilometerstand und Positionen mit korrigierter Kategorie', () => {
    expect(scannedToFormFields(parsed)).toEqual({
      workshop: 'Lucky Car Dornbirn',
      date: '2025-04-15',
      amount: 1403.34,
      currency: 'EUR',
      mileage: 252586,
      items: [
        { description: 'Motoröl wechseln', category: 'oelwechsel', amount: 180 },
        { description: 'Auspuff reparieren', category: 'auspuff', amount: 1100 },
      ],
    })
  })

  it('lässt unbrauchbare Werte weg: kein ISO-Datum, Währung ausser CHF/EUR, Kilometer 0, Betrag 0', () => {
    const fields = scannedToFormFields({ ...parsed, date: '15.04.2025', currency: 'USD', mileageAtService: 0, totalAmount: 0, items: [] })
    expect(fields).toEqual({ workshop: 'Lucky Car Dornbirn' })
  })
})

describe('fillEmptyFields', () => {
  it('füllt nur leere Felder, Eingaben des Nutzers bleiben', () => {
    const current = { date: '2026-02-08', workshop: '', amount: 250, currency: 'CHF' as const, description: '', mileage: undefined }
    const merged = fillEmptyFields(current, scannedToFormFields(parsed), { currencyTouched: false })
    expect(merged.date).toBe('2026-02-08')
    expect(merged.amount).toBe(250)
    expect(merged.workshop).toBe('Lucky Car Dornbirn')
    expect(merged.mileage).toBe(252586)
    expect(merged.items).toHaveLength(2)
  })

  it('übernimmt die Währung des Belegs, solange der Nutzer sie nicht selbst gewählt hat', () => {
    const current = { date: '', currency: 'CHF' as const }
    expect(fillEmptyFields(current, { currency: 'EUR' }, { currencyTouched: false }).currency).toBe('EUR')
    expect(fillEmptyFields(current, { currency: 'EUR' }, { currencyTouched: true }).currency).toBe('CHF')
  })
})
