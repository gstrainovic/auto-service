/**
 * Zugriff auf die Mistral-API: entweder über den eigenen AI-Proxy (Abo-Modus, `VITE_AI_PROXY_URL` gesetzt)
 * oder direkt mit eigenem Key (Bring-your-own-key, Fallback für Entwicklung).
 *
 * Proxy-Modus: Bearer = InstantDB-Refresh-Token des Nutzers, der Proxy hält den Mistral-Key.
 * Lokaler Modus (E2E): kein echtes Token, User-ID per `x-user-id` (Proxy läuft im Auth-Bypass).
 */
import type { LimitKind, PlanId } from '../shared/plans'
import { getCurrentUserId } from '../composables/useAuth'
import { db } from '../lib/instantdb'

export interface AiAccess {
  baseURL: string
  apiKey: string
  headers?: Record<string, string>
}

export const AI_PROXY_URL = ((import.meta.env.VITE_AI_PROXY_URL as string | undefined) ?? '').replace(/\/$/, '')
export const isProxyMode = AI_PROXY_URL !== ''
const isLocal = import.meta.env.VITE_INSTANTDB_MODE === 'local'

export function byokAccess(apiKey: string): AiAccess {
  return { baseURL: 'https://api.mistral.ai/v1', apiKey }
}

export async function getAiAccess(byokKey: string): Promise<AiAccess> {
  if (!isProxyMode)
    return byokAccess(byokKey)

  const headers: Record<string, string> = {}
  let token = ''
  if (isLocal)
    headers['x-user-id'] = getCurrentUserId()
  else
    token = (await db.getAuth())?.refresh_token ?? ''

  // createMistral verlangt einen nicht-leeren apiKey; im Bypass zählt nur der Header
  return { baseURL: `${AI_PROXY_URL}/v1`, apiKey: token || 'proxy', headers }
}

export interface UsageInfo {
  plan: PlanId
  month: string
  usage: Record<LimitKind, number>
  limits: Record<LimitKind, number>
}

async function proxyFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const access = await getAiAccess('')
  return fetch(`${AI_PROXY_URL}${path}`, {
    ...init,
    headers: {
      ...access.headers,
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${access.apiKey}`,
    },
  })
}

export async function fetchUsage(): Promise<UsageInfo> {
  const res = await proxyFetch('/me/usage')
  if (!res.ok)
    throw new Error(`Nutzung konnte nicht geladen werden (${res.status})`)
  return res.json()
}

/** Startet Stripe Checkout für einen Plan; gibt die Checkout-URL zurück. */
export async function startCheckout(plan: PlanId): Promise<string> {
  const res = await proxyFetch('/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  })
  const body = await res.json().catch(() => ({})) as { url?: string, error?: { message?: string } }
  if (!res.ok || !body.url)
    throw new Error(body.error?.message || `Checkout nicht möglich (${res.status})`)
  return body.url
}
