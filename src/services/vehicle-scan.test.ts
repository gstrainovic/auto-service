import type { ParsedVehicleDocument } from './ai'
import { describe, expect, it } from 'vitest'
import { fillVehicleFields, vehicleDocToFields } from './vehicle-scan'

// Werte vom gemeinfreien Beispiel-Fahrzeugausweis (Wikimedia Commons, «Fahrzeugausweis Schweiz.jpg»)
const ausweis: ParsedVehicleDocument = {
  documentType: 'fahrzeugausweis',
  make: 'SAURER',
  model: '3 DUX',
  year: 1964,
  vin: '2 100 728',
  plate: 'BS',
  mileage: 405260,
}

describe('vehicleDocToFields', () => {
  it('übernimmt Marke, Modell, Baujahr, Kilometerstand, Kontrollschild und Fahrgestellnummer', () => {
    expect(vehicleDocToFields(ausweis)).toEqual({
      make: 'Saurer',
      model: '3 DUX',
      year: 1964,
      mileage: 405260,
      licensePlate: 'BS',
      vin: '2 100 728',
    })
  })

  it('schreibt Grossbuchstaben-Wörter ab vier Buchstaben normal, kurze Kürzel bleiben', () => {
    const f = vehicleDocToFields({ ...ausweis, make: 'MERCEDES-BENZ', model: 'GOLF VI GTI' })
    expect(f.make).toBe('Mercedes-Benz')
    expect(f.model).toBe('Golf VI GTI')
    expect(vehicleDocToFields({ ...ausweis, make: 'BMW', model: '320d' })).toMatchObject({ make: 'BMW', model: '320d' })
  })

  it('normiert Kontrollschild und 17-stellige VIN, verwirft unplausible Werte', () => {
    const f = vehicleDocToFields({ ...ausweis, plate: ' sg  218574 ', vin: 'WP1ZZZ 9PZ8LA 14872', year: 64, mileage: 0 })
    expect(f.licensePlate).toBe('SG 218574')
    expect(f.vin).toBe('WP1ZZZ9PZ8LA14872')
    expect(f.year).toBeUndefined()
    expect(f.mileage).toBeUndefined()
  })
})

describe('fillVehicleFields', () => {
  const empty = { make: '', model: '', year: 2026, mileage: 0, licensePlate: '', vin: '' }

  it('füllt leere Felder; das vorbelegte Baujahr gilt als leer, solange der Nutzer es nicht geändert hat', () => {
    expect(fillVehicleFields(empty, vehicleDocToFields(ausweis), { yearTouched: false })).toEqual({
      make: 'Saurer',
      model: '3 DUX',
      year: 1964,
      mileage: 405260,
      licensePlate: 'BS',
      vin: '2 100 728',
    })
  })

  it('lässt Eingaben des Nutzers stehen', () => {
    const typed = { ...empty, make: 'Saurer AG', year: 1963, mileage: 405300 }
    expect(fillVehicleFields(typed, vehicleDocToFields(ausweis), { yearTouched: true })).toMatchObject({ make: 'Saurer AG', year: 1963, mileage: 405300, model: '3 DUX' })
  })
})
