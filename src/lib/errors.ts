/**
 * Fehler aus API, Proxy und Netz in eine kurze Nutzermeldung übersetzen.
 * Technische Details gehen nur in die Konsole, nie in die Oberfläche.
 */

const LIMIT = 'Monatslimit erreicht. Upgrade in den Einstellungen.'
const RATE = 'Zu viele Anfragen, bitte kurz warten.'
const OFFLINE = 'Keine Verbindung. Bitte Internet prüfen.'
const AUTH = 'Bitte neu anmelden.'
const GENERIC = 'Das hat nicht geklappt. Bitte nochmals versuchen.'

function statusOf(err: unknown): number | undefined {
  if (!err || typeof err !== 'object')
    return undefined
  const e = err as Record<string, unknown>
  for (const key of ['statusCode', 'status'] as const) {
    if (typeof e[key] === 'number')
      return e[key] as number
  }
  return undefined
}

function messageOf(err: unknown): string {
  if (err instanceof Error)
    return `${err.name} ${err.message}`
  return typeof err === 'string' ? err : ''
}

export function userMessage(err: unknown): string {
  const status = statusOf(err)
  const msg = messageOf(err)
  const has = (code: number) => status === code || new RegExp(`\\b${code}\\b`).test(msg)

  // 429 vor dem Monatslimit prüfen: «Rate limit» enthält ebenfalls «limit»
  if (has(429) || /rate.?limit/i.test(msg))
    return RATE
  // Der ai-proxy formuliert das Monatslimit schon für Nutzer (mit Kontingent und Plan)
  if (err instanceof Error && (err.message.startsWith('Monatslimit erreicht') || err.message.startsWith('Testzeit vorbei')))
    return err.message
  if (has(402) || /limit/i.test(msg))
    return LIMIT
  if (/failed to fetch|fetch failed|networkerror|network request failed|offline|load failed/i.test(msg))
    return OFFLINE
  if (has(401) || has(403))
    return AUTH
  console.error('[fehler]', err)
  return GENERIC
}
