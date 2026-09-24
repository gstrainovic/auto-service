/**
 * Zugriff auf die Mistral-API, immer über den eigenen AI-Proxy (`VITE_AI_PROXY_URL`).
 * Der Browser sieht nie einen Mistral-Key: Bearer = InstantDB-Refresh-Token des Nutzers, der Proxy hält den Key.
 * Lokaler Modus (E2E): kein echtes Token, User-ID per `x-user-id` (Proxy läuft im Auth-Bypass).
 */
import type { LimitKind, PlanId } from '@strainovic/ai-proxy/plans'
import { getCurrentUserId } from '../composables/useAuth'
import { db } from '../lib/instantdb'

export interface AiAccess {
  baseURL: string
  apiKey: string
  headers?: Record<string, string>
}

export const AI_PROXY_URL = ((import.meta.env.VITE_AI_PROXY_URL as string | undefined) ?? '').replace(/\/$/, '')
const isLocal = import.meta.env.VITE_INSTANTDB_MODE === 'local'

export async function getAiAccess(): Promise<AiAccess> {
  if (!AI_PROXY_URL)
    throw new Error('VITE_AI_PROXY_URL fehlt. Die App spricht Mistral nur über den AI-Proxy an.')

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
  /** Testzeit ohne Abo; null bei aktivem Abo */
  trial?: { active: boolean, daysLeft: number, endsAt: string } | null
  /** Der Proxy nimmt Bestellungen an (IBAN und Versand konfiguriert); sonst zeigt die App keinen Kaufweg */
  ordering?: boolean
  /** Jahresabo auf Rechnung (Betrieb); null ohne */
  billing?: BusinessBilling | null
}

export interface BusinessBilling {
  method: 'invoice'
  audience: 'privat' | 'betrieb'
  /** Firma; bei Privatkunden leer, dann steht der Name in `contact` */
  company: string
  contact: string
  vehicles: number
  /** Ende der bezahlten Laufzeit (ISO, exklusiv) */
  periodEnd: string | null
  cancelAtPeriodEnd: boolean
  openInvoice: { number: string, reference: string, amount: number, dueAt: string } | null
}

export interface BusinessOrder {
  /** Preisliste: privat 25 CHF bis 5 Fahrzeuge, betrieb 36 CHF pro Fahrzeug */
  audience: 'privat' | 'betrieb'
  /** Firma; bei Privatkunden leer */
  company: string
  contact: string
  street: string
  zip: string
  city: string
  email: string
  reference?: string
  vehicles: number
  acceptTerms: boolean
}

/** Fehler der Bestellung mit Meldungen pro Feld (400 vom Proxy) */
export class OrderError extends Error {
  readonly fields: Partial<Record<keyof BusinessOrder, string>>
  constructor(message: string, fields: Partial<Record<keyof BusinessOrder, string>> = {}) {
    super(message)
    this.fields = fields
  }
}

async function proxyFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const access = await getAiAccess()
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
export async function startCheckout(plan: string): Promise<string> {
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

async function billingPost<T>(path: string, payload: unknown = {}): Promise<T> {
  const res = await proxyFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({})) as T & { error?: { message?: string, fields?: Record<string, string> } }
  if (!res.ok)
    throw new OrderError(body.error?.message || `Abo-Aktion nicht möglich (${res.status})`, body.error?.fields ?? {})
  return body
}

/**
 * Jahresabo auf Rechnung bestellen; die Rechnung kommt per Mail an die Rechnungs-E-Mail. `manual`: der Proxy hat
 * keine IBAN und schickt den Auftrag an den Betreiber, der die Rechnung von Hand schreibt (`mailed` gilt dann dafür).
 */
export function orderBusinessPlan(order: BusinessOrder): Promise<{ invoice: { number: string, amount: number, dueAt: string }, mailed: boolean, manual?: boolean }> {
  return billingPost('/billing/order', order)
}

/** Kündigung auf Ende der Laufzeit; `voided` zählt stornierte Rechnungen (Kündigung vor Beginn des Jahres) */
export function cancelBusinessPlan(): Promise<{ billing: BusinessBilling | null, voided: number }> {
  return billingPost('/billing/cancel')
}

export function resumeBusinessPlan(): Promise<{ billing: BusinessBilling }> {
  return billingPost('/billing/resume')
}

/** Kontolöschung beim Proxy: Verbrauch, Testzeit und Login; ein Abo mit Rechnungen bleibt gekündigt als Beleg */
export function deleteAccount(): Promise<{ ok: true }> {
  return billingPost('/me/delete')
}

/**
 * Rückmeldung an den Betreiber: Text, Sprachnachricht oder beides. Der Proxy transkribiert die Aufnahme und
 * schickt beides per Mail; `transcript` kommt zurück, damit die App zeigen kann, was verstanden wurde.
 */
export async function sendFeedback(input: { text?: string, audio?: Blob | null, page?: string }): Promise<{ transcript: string | null }> {
  const form = new FormData()
  if (input.text)
    form.append('text', input.text)
  if (input.page)
    form.append('page', input.page)
  if (input.audio)
    form.append('audio', input.audio, `nachricht.${input.audio.type.includes('mp4') ? 'mp4' : 'webm'}`)
  const res = await proxyFetch('/feedback', { method: 'POST', body: form })
  const json = await res.json().catch(() => ({})) as any
  if (!res.ok)
    throw new Error(json?.error?.message ?? `Rückmeldung nicht gesendet (${res.status})`)
  return { transcript: json.transcript ?? null }
}

/** Diktat: Aufnahme an den Proxy, erkannter Text zurück (`/me/transcribe`) */
export async function transcribeAudio(audio: Blob): Promise<{ text: string }> {
  const form = new FormData()
  form.append('audio', audio, `diktat.${audio.type.includes('mp4') ? 'mp4' : 'webm'}`)
  const res = await proxyFetch('/me/transcribe', { method: 'POST', body: form })
  const json = await res.json().catch(() => ({})) as any
  if (!res.ok)
    throw new Error(json?.error?.message ?? `Diktat nicht erkannt (${res.status})`)
  return { text: String(json.text ?? '') }
}
