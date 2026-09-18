import { describe, expect, it } from 'vitest'
import { nextSetupStep, setupSteps } from './vehicle-setup'

const complete = { licensePlate: 'SG 12345', vin: 'WVWZZZ1KZ6W000001', year: 2019, customSchedule: [{ type: 'oelwechsel', label: 'Ölwechsel', intervalKm: 15000, intervalMonths: 12 }] }

describe('setupSteps', () => {
  it('führt die vier Schritte in der empfohlenen Reihenfolge', () => {
    const steps = setupSteps({ vehicle: { licensePlate: '' }, doneMaintenances: 0, invoices: 0 })
    expect(steps.map(s => s.key)).toEqual(['ausweis', 'serviceheft', 'wartungen', 'rechnungen'])
    expect(steps.every(s => !s.done)).toBe(true)
  })

  it('leitet «erledigt» aus den Daten ab, nicht aus Klicks', () => {
    const steps = setupSteps({ vehicle: complete, doneMaintenances: 2, invoices: 1 })
    expect(steps.every(s => s.done)).toBe(true)
    expect(nextSetupStep(steps)).toBeUndefined()
  })

  it('nennt beim Fahrzeugausweis, was noch fehlt (z. B. nach einem Kaufvertrag)', () => {
    const [ausweis] = setupSteps({ vehicle: { licensePlate: 'SG 12345', vin: '', year: 0 }, doneMaintenances: 0, invoices: 0 })
    expect(ausweis!.done).toBe(false)
    expect(ausweis!.hint).toBe('Fehlt noch: Fahrgestellnummer, Baujahr')
  })

  it('hakt den Fahrzeugausweis ab, wenn Kontrollschild, Fahrgestellnummer und Baujahr da sind', () => {
    const [ausweis] = setupSteps({ vehicle: { licensePlate: 'SG 1', vin: 'X', year: 2019 }, doneMaintenances: 0, invoices: 0 })
    expect(ausweis!.done).toBe(true)
  })

  it('nächster Schritt ist der erste offene, auch wenn spätere schon erledigt sind', () => {
    // Rechnungen zuerst fotografiert: die Wartungen daraus zählen, das Serviceheft fehlt trotzdem
    const steps = setupSteps({ vehicle: { ...complete, customSchedule: [] }, doneMaintenances: 3, invoices: 3 })
    expect(steps.map(s => s.done)).toEqual([true, false, true, true])
    expect(nextSetupStep(steps)?.key).toBe('serviceheft')
  })

  it('jeder Schritt hat eine Beschriftung für seinen Knopf', () => {
    const steps = setupSteps({ vehicle: { licensePlate: '' }, doneMaintenances: 0, invoices: 0 })
    expect(steps.map(s => s.action)).toEqual([
      'Fahrzeugausweis fotografieren',
      'Serviceheft fotografieren',
      'Letzte Wartungen eintragen',
      'Rechnung fotografieren',
    ])
  })
})
