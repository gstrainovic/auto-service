/**
 * Einrichtungs-Checkliste pro Fahrzeug: empfohlene Reihenfolge, aber kein Zwang. «Erledigt» folgt aus den Daten,
 * egal über welchen Weg sie kamen (Formular, Chat, Scan), damit ein Kaufvertrag statt Ausweis als Lücke sichtbar bleibt.
 */

export type SetupStepKey = 'ausweis' | 'serviceheft' | 'wartungen' | 'rechnungen'

export interface SetupStep {
  key: SetupStepKey
  label: string
  /** Knopf-Beschriftung */
  action: string
  hint: string
  done: boolean
}

export interface SetupInput {
  vehicle: { licensePlate?: string, vin?: string, year?: number, customSchedule?: unknown[] }
  /** Wartungen mit Status «erledigt», aus welcher Quelle auch immer */
  doneMaintenances: number
  invoices: number
}

export function setupSteps({ vehicle, doneMaintenances, invoices }: SetupInput): SetupStep[] {
  const missing = [
    !vehicle.licensePlate && 'Kontrollschild',
    !vehicle.vin && 'Fahrgestellnummer',
    !vehicle.year && 'Baujahr',
  ].filter(Boolean)

  return [
    {
      key: 'ausweis',
      label: 'Fahrzeugausweis',
      action: 'Fahrzeugausweis fotografieren',
      hint: missing.length ? `Fehlt noch: ${missing.join(', ')}` : 'Stammdaten vollständig',
      done: !missing.length,
    },
    {
      key: 'serviceheft',
      label: 'Serviceheft',
      action: 'Serviceheft fotografieren',
      hint: 'Intervalle des Herstellers und Stempel, damit die Termine für genau dieses Fahrzeug stimmen',
      done: !!vehicle.customSchedule?.length,
    },
    {
      key: 'wartungen',
      label: 'Letzte Wartungen',
      action: 'Letzte Wartungen eintragen',
      hint: 'Wann wurden Service, Öl und MFK zuletzt gemacht? Ohne das gibt es keine Erinnerung',
      done: doneMaintenances > 0,
    },
    {
      key: 'rechnungen',
      label: 'Rechnungen',
      action: 'Rechnung fotografieren',
      hint: 'Werkstattrechnungen für Kosten und lückenlose Historie',
      done: invoices > 0,
    },
  ]
}

export function nextSetupStep(steps: SetupStep[]): SetupStep | undefined {
  return steps.find(s => !s.done)
}
