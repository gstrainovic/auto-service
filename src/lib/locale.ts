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

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

/**
 * Datum als TT.MM.JJJJ. ISO-Strings werden textuell gelesen (kein Date-Parsing, also keine Verschiebung um einen Tag
 * durch Zeitzonen); Date-Objekte nach lokaler Zeit. Unbekannte Formate bleiben unverändert, leer bleibt leer.
 */
export function formatDate(value: string | Date | undefined | null): string {
  if (!value)
    return ''
  if (value instanceof Date)
    return `${String(value.getDate()).padStart(2, '0')}.${String(value.getMonth() + 1).padStart(2, '0')}.${value.getFullYear()}`
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : value
}

/** Monat «JJJJ-MM» als «September 2026» */
export function formatMonth(value: string | undefined | null): string {
  const m = /^(\d{4})-(\d{2})/.exec(value ?? '')
  if (!m)
    return value ?? ''
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`
}

const CURRENCY_ALIASES: Record<string, string> = {
  '€': 'EUR',
  'EURO': 'EUR',
  'FR.': 'CHF',
  'FR': 'CHF',
  'SFR.': 'CHF',
  'SFR': 'CHF',
  'FRANKEN': 'CHF',
  '$': 'USD',
  'US$': 'USD',
}

/** Währung aus Scan oder Formular auf einen ISO-Code bringen; leer heisst Standardwährung, Unbekanntes bleibt stehen. */
export function normalizeCurrency(value: string | undefined | null): string {
  const raw = (value ?? '').trim()
  if (!raw)
    return DEFAULT_CURRENCY
  const upper = raw.toUpperCase()
  return CURRENCY_ALIASES[upper] ?? upper
}
