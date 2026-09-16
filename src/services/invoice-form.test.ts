import { describe, expect, it } from 'vitest'
import { formToInvoiceInput } from './invoice-form'

describe('formToInvoiceInput', () => {
  it('nimmt die Positionen aus dem Scan und das Foto mit', () => {
    const input = formToInvoiceInput({
      date: '2026-03-10',
      workshop: 'Garage Kunz',
      amount: 480,
      currency: 'CHF',
      mileage: 61000,
      items: [{ description: 'Ölwechsel', category: 'oelwechsel', amount: 480 }],
      images: ['BASE64'],
    }, 'v1')
    expect(input).toEqual({
      vehicleId: 'v1',
      workshopName: 'Garage Kunz',
      date: '2026-03-10',
      totalAmount: 480,
      currency: 'CHF',
      mileageAtService: 61000,
      items: [{ description: 'Ölwechsel', category: 'oelwechsel', amount: 480 }],
      imageData: 'BASE64',
    })
  })

  it('baut ohne Positionen eine aus Kategorie und Beschreibung, leere Felder bleiben leer', () => {
    const input = formToInvoiceInput({ date: '2026-03-10', amount: 120, category: 'bremsen', description: 'Bremsbeläge' }, 'v2')
    expect(input).toMatchObject({
      workshopName: '',
      currency: 'CHF',
      mileageAtService: undefined,
      items: [{ description: 'Bremsbeläge', category: 'bremsen', amount: 120 }],
    })
    expect(input.imageData).toBeUndefined()
  })

  it('lässt die Positionsliste leer, wenn weder Positionen noch Kategorie da sind', () => {
    expect(formToInvoiceInput({ date: '2026-03-10', amount: 50 }, 'v3').items).toEqual([])
  })
})
