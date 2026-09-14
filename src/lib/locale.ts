/**
 * Deploy-Standards für die Schweiz: Währung CHF, Zahlenformat 1'234.50 (Apostroph, Punkt).
 * Bewusst ohne Intl: Browser und Node liefern für de-CH unterschiedliche Apostrophe (U+2019 bzw. U+0027),
 * das Format soll überall gleich aussehen und in Tests vergleichbar sein.
 * Für DACH oder global werden daraus Einstellungen pro Deployment und pro Nutzer (siehe todo.md).
 */
export const DEFAULT_CURRENCY = 'CHF'
export const LOCALE = 'de-CH'
const THOUSANDS = '\''

export function formatNumber(value: number | undefined | null, decimals = 0): string {
  const fixed = Math.abs(value ?? 0).toFixed(decimals)
  const [whole, fraction] = fixed.split('.')
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS)
  const sign = (value ?? 0) < 0 ? '-' : ''
  return fraction ? `${sign}${grouped}.${fraction}` : `${sign}${grouped}`
}

export function formatCurrency(value: number | undefined | null, currency: string = DEFAULT_CURRENCY): string {
  return `${currency} ${formatNumber(value, 2)}`
}
