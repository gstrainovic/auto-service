/**
 * Fahrzeuggrenze des Privatplans. Solange kein Zahlungsanbieter eingerichtet ist (`VITE_BILLING_ENABLED`),
 * wird nichts gesperrt: die ersten Kunden zahlen per Jahresrechnung, und ein hartes Limit ohne Kaufweg
 * würde nur bestehende Konten lahmlegen. Der Betriebsplan rechnet pro Fahrzeug und hat keine Grenze.
 */
import type { Plan } from '@strainovic/ai-proxy/plans'
import { BUSINESS_VEHICLE_YEARLY_CHF, yearlyPriceChf } from '@strainovic/ai-proxy/plans'
import { formatCurrency } from '../lib/locale'

export interface VehicleLimitState {
  /** true, wenn kein weiteres Fahrzeug im Plan enthalten ist */
  reached: boolean
  /** Hinweistext für die Fahrzeugliste; leer, wenn nichts zu sagen ist */
  note: string
}

export function vehicleLimit(count: number, plan: Plan | undefined, billingEnabled: boolean): VehicleLimitState {
  const max = plan?.maxVehicles
  if (!billingEnabled || !max || plan?.perVehicle || count < max)
    return { reached: false, note: '' }
  const next = count + 1
  const word = ['', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn'][next] ?? String(next)
  return {
    reached: true,
    note: `Dein Privatplan deckt ${max} ${max === 1 ? 'Fahrzeug' : 'Fahrzeuge'}. Ab dem ${max === 5 ? 'sechsten' : 'nächsten'} gilt der Betriebspreis: ${formatCurrency(BUSINESS_VEHICLE_YEARLY_CHF)} pro Fahrzeug und Jahr, also ${formatCurrency(yearlyPriceChf(next, 'betrieb'))} für ${word}.`,
  }
}
