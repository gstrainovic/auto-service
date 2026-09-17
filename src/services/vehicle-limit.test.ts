import type { Plan } from '@strainovic/ai-proxy/plans'
import { describe, expect, it } from 'vitest'
import { vehicleLimit } from './vehicle-limit'

const privat: Plan = { id: 'privat', name: 'Privat', priceChfPerMonth: 25 / 12, maxVehicles: 5, limits: { ocrPages: 250, chatTokens: 2_000_000 } }
const betrieb: Plan = { id: 'betrieb', name: 'Betrieb', priceChfPerMonth: 3, perVehicle: true, limits: { ocrPages: 2500, chatTokens: 12_000_000 } }

describe('vehicleLimit', () => {
  it('meldet nichts, solange die Abrechnung aus ist', () => {
    expect(vehicleLimit(9, privat, false)).toEqual({ reached: false, note: '' })
  })

  it('meldet nichts, solange noch Fahrzeuge im Privatplan frei sind', () => {
    expect(vehicleLimit(4, privat, true).reached).toBe(false)
  })

  it('nennt beim fünften Fahrzeug den Betriebspreis für das nächste', () => {
    const state = vehicleLimit(5, privat, true)
    expect(state.reached).toBe(true)
    expect(state.note).toBe('Dein Privatplan deckt 5 Fahrzeuge. Ab dem sechsten gilt der Betriebspreis: CHF 36.00 pro Fahrzeug und Jahr, also CHF 216.00 für sechs.')
  })

  it('kennt beim Betriebsplan keine Grenze', () => {
    expect(vehicleLimit(50, betrieb, true).reached).toBe(false)
    expect(vehicleLimit(50, undefined, true).reached).toBe(false)
  })
})
