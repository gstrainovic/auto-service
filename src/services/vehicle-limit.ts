/**
 * Fahrzeuggrenze der Preisstaffel. Solange kein Zahlungsanbieter eingerichtet ist (`VITE_BILLING_ENABLED`),
 * wird nichts gesperrt: die ersten Kunden zahlen per Jahresrechnung, und ein hartes Limit ohne Kaufweg
 * würde nur bestehende Konten lahmlegen.
 */
import type { Plan } from '@strainovic/ai-proxy/plans'
import { yearlyPriceChf } from '@strainovic/ai-proxy/plans'
import { formatCurrency } from '../lib/locale'

export interface VehicleLimitState {
  /** true, wenn kein weiteres Fahrzeug im Plan enthalten ist */
  reached: boolean
  /** Hinweistext für die Fahrzeugliste; leer, wenn nichts zu sagen ist */
  note: string
}

export function vehicleLimit(count: number, plan: Plan | undefined, billingEnabled: boolean): VehicleLimitState {
  const max = plan?.maxVehicles
  if (!billingEnabled || !max || count < max)
    return { reached: false, note: '' }
  const next = yearlyPriceChf(count + 1)
  return {
    reached: true,
    note: `Dein Abo deckt ${max} ${max === 1 ? 'Fahrzeug' : 'Fahrzeuge'}. Mit dem nächsten Fahrzeug kostet es ${formatCurrency(next)} im Jahr.`,
  }
}
