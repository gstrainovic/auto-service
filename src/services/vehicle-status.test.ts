import { describe, expect, it } from 'vitest'
import { activeVehicles, isSold, soldLabel, soldVehicles } from './vehicle-status'

const today = '2026-09-16'
const fleet = [
  { id: 'v1', make: 'VW', model: 'Caddy' },
  { id: 'v2', make: 'Fiat', model: 'Ducato', soldAt: '2026-05-02', soldMileage: 187400 },
  // Übergabe erst nächste Woche: bis dahin ein eigenes Fahrzeug
  { id: 'v3', make: 'Opel', model: 'Corsa', soldAt: '2026-09-23' },
]

describe('isSold', () => {
  it('gilt ab dem Tag der Übergabe', () => {
    expect(isSold(fleet[0]!, today)).toBe(false)
    expect(isSold(fleet[1]!, today)).toBe(true)
    expect(isSold(fleet[2]!, today)).toBe(false)
    expect(isSold({ make: 'a', model: 'b', soldAt: today }, today)).toBe(true)
    expect(isSold({ make: 'a', model: 'b', soldAt: '' }, today)).toBe(false)
  })
})

describe('activeVehicles und soldVehicles', () => {
  it('teilt die Flotte, Reihenfolge bleibt', () => {
    expect(activeVehicles(fleet, today).map(v => v.id)).toEqual(['v1', 'v3'])
    expect(soldVehicles(fleet, today).map(v => v.id)).toEqual(['v2'])
  })
})

describe('soldLabel', () => {
  it('nennt Datum und Kilometerstand, Kilometer nur wenn bekannt', () => {
    expect(soldLabel(fleet[1]!)).toBe('Verkauft am 02.05.2026 bei 187\'400 km')
    expect(soldLabel({ make: 'a', model: 'b', soldAt: '2026-05-02' })).toBe('Verkauft am 02.05.2026')
    expect(soldLabel({ make: 'a', model: 'b', soldAt: '2026-09-23' }, today)).toBe('Übergabe am 23.09.2026')
    expect(soldLabel(fleet[0]!)).toBe('')
  })
})
