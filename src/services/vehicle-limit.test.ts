import type { Plan } from '@strainovic/ai-proxy/plans'
import { describe, expect, it } from 'vitest'
import { vehicleLimit } from './vehicle-limit'

const klein: Plan = { id: 'klein', name: 'Bis 3 Fahrzeuge', priceChfPerMonth: 7, maxVehicles: 3, limits: { ocrPages: 15, chatTokens: 1_000_000 } }

describe('vehicleLimit', () => {
  it('meldet nichts, solange die Abrechnung aus ist', () => {
    expect(vehicleLimit(9, klein, false)).toEqual({ reached: false, note: '' })
  })

  it('meldet nichts, solange noch Fahrzeuge im Abo frei sind', () => {
    expect(vehicleLimit(2, klein, true).reached).toBe(false)
  })

  it('nennt beim Erreichen der Grenze den Preis des nächsten Fahrzeugs', () => {
    const state = vehicleLimit(3, klein, true)
    expect(state.reached).toBe(true)
    expect(state.note).toBe('Dein Abo deckt 3 Fahrzeuge. Mit dem nächsten Fahrzeug kostet es CHF 108.00 im Jahr.')
  })

  it('kommt mit einem Plan ohne Fahrzeuggrenze zurecht', () => {
    expect(vehicleLimit(50, { ...klein, maxVehicles: undefined }, true).reached).toBe(false)
    expect(vehicleLimit(50, undefined, true).reached).toBe(false)
  })
})
