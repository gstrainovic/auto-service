/**
 * Abo-Job für Betriebe mit Jahresrechnung. Liest Abos (`subscriptions` mit billing = invoice) und Fahrzeuge über die
 * Admin-API von InstantDB; Rechnungen erzeugt und verschickt der AI-Proxy über seine internen Endpunkte.
 *
 *   node billing.mjs renew [--dry-run]    fällige Verlängerungen (30 Tage vor Ablauf) auslösen, danach offene Rechnungen
 *   node billing.mjs open                 offene Rechnungen, überfällige markiert
 *   node billing.mjs paid <Referenz> [JJJJ-MM-TT]   Zahlung eintragen (Referenz oder Rechnungsnummer aus dem Kontoauszug)
 *   node billing.mjs camt <datei.xml> [--dry-run]  camt.054 aus dem E-Banking einlesen und passende Zahlungen buchen
 *
 * Läuft auf der Instanz als Container (deploy/docker-compose.yml, Dienst `billing`, Profil `jobs`), gebündelt mit
 * `npm run build:billing` nach deploy/billing.mjs. Umgebung: INSTANT_API_URI, INSTANT_APP_ID, INSTANT_ADMIN_TOKEN,
 * AI_PROXY_URL, AI_PROXY_INTERNAL_TOKEN.
 */
import type { InvoiceEntry } from '../src/services/billing-job'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { parseCamt054 } from '@strainovic/ai-proxy/camt'
import { dueRenewals, findInvoiceOwner, matchCredits, openInvoiceReport } from '../src/services/billing-job'

const API = process.env.INSTANT_API_URI ?? ''
const APP_ID = process.env.INSTANT_APP_ID ?? ''
const ADMIN_TOKEN = process.env.INSTANT_ADMIN_TOKEN ?? ''
const PROXY = (process.env.AI_PROXY_URL ?? '').replace(/\/$/, '')
const INTERNAL_TOKEN = process.env.AI_PROXY_INTERNAL_TOKEN ?? ''

const [command = 'renew', ...args] = process.argv.slice(2).filter(a => !a.startsWith('--'))
const dryRun = process.argv.includes('--dry-run')
const today = new Date().toISOString().slice(0, 10)

function log(msg: string): void {
  console.log(`${new Date().toISOString()} ${msg}`)
}

async function admin(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${API}/admin/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'App-Id': APP_ID, 'Authorization': `Bearer ${ADMIN_TOKEN}` },
    body: JSON.stringify(body),
  })
  if (!res.ok)
    throw new Error(`Admin-API ${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function proxy(path: string, userId: string, body: unknown): Promise<any> {
  const res = await fetch(`${PROXY}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${INTERNAL_TOKEN}`, 'x-user-id': userId },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok)
    throw new Error(`AI-Proxy ${path}: ${res.status} ${json?.error?.message ?? ''}`)
  return json
}

async function load(withVehicles: boolean): Promise<{ entries: InvoiceEntry[], vehicles: any[] }> {
  const { subscriptions = [], vehicles = [] } = await admin('query', {
    query: { subscriptions: { $: { where: { billing: 'invoice' } } }, ...(withVehicles ? { vehicles: {} } : {}) },
  })
  const entries = (subscriptions as any[]).map(row => ({ userId: row.userId as string, sub: { ...row, invoices: row.invoices ?? [] } }))
  return { entries, vehicles }
}

function printOpen(entries: InvoiceEntry[]): void {
  const report = openInvoiceReport(entries, today)
  if (!report.length) {
    log('keine offenen Rechnungen')
    return
  }
  for (const r of report)
    log(`${r.overdue ? 'ÜBERFÄLLIG ' : ''}${r.invoice.number} ${r.company} <${r.email}> CHF ${r.invoice.amount.toFixed(2)} fällig ${r.invoice.dueAt} Referenz ${r.invoice.reference}`)
}

async function main(): Promise<void> {
  for (const [name, value] of Object.entries({ INSTANT_API_URI: API, INSTANT_APP_ID: APP_ID, INSTANT_ADMIN_TOKEN: ADMIN_TOKEN, AI_PROXY_URL: PROXY, AI_PROXY_INTERNAL_TOKEN: INTERNAL_TOKEN })) {
    if (!value)
      throw new Error(`${name} fehlt`)
  }

  if (command === 'renew') {
    const { entries, vehicles } = await load(true)
    const due = dueRenewals(entries, vehicles, today)
    log(`${entries.length} Abo(s) auf Rechnung, ${due.length} Verlängerung(en) fällig`)
    for (const d of due) {
      if (dryRun) {
        log(`[dry-run] ${d.company} (${d.userId}): Verlängerung mit ${d.vehicles} Fahrzeug(en)`)
        continue
      }
      const { invoice, mailed } = await proxy('/billing/renew', d.userId, { vehicles: d.vehicles })
      log(`${d.company}: Rechnung ${invoice.number} über CHF ${invoice.amount.toFixed(2)}${mailed ? '' : ', Mail FEHLGESCHLAGEN'}`)
    }
    printOpen((await load(false)).entries)
    return
  }

  if (command === 'open') {
    printOpen((await load(false)).entries)
    return
  }

  if (command === 'camt') {
    const [file] = args
    if (!file)
      throw new Error('Aufruf: billing.mjs camt <camt054.xml> [--dry-run]')
    const credits = parseCamt054(readFileSync(file, 'utf8'))
    const { entries } = await load(false)
    const matches = matchCredits(entries, credits)
    log(`${file}: ${credits.length} Gutschrift(en)`)
    for (const m of matches) {
      const who = `${m.credit.debtor || 'unbekannt'} CHF ${m.credit.amount.toFixed(2)} vom ${m.credit.bookedAt}`
      if (m.problem) {
        log(`PRÜFEN ${who}: ${m.problem}`)
        continue
      }
      if (dryRun) {
        log(`[dry-run] ${m.invoice!.number} bezahlt durch ${who}`)
        continue
      }
      await proxy('/billing/paid', m.userId!, {
        key: m.credit.reference,
        paidAt: m.credit.bookedAt,
        amount: m.credit.amount,
        bankRef: m.credit.bankRef,
      })
      log(`${m.invoice!.number} bezahlt durch ${who}`)
    }
    printOpen((await load(false)).entries)
    return
  }

  if (command === 'paid') {
    const [key, paidAt = today] = args
    if (!key)
      throw new Error('Aufruf: billing.mjs paid <Referenz> [JJJJ-MM-TT]')
    const { entries } = await load(false)
    const userId = findInvoiceOwner(entries, key)
    await proxy('/billing/paid', userId, { key, paidAt })
    log(`Zahlung ${key} vom ${paidAt} eingetragen (${userId})`)
    return
  }

  throw new Error(`Unbekannter Befehl ${command}: renew, open, paid oder camt`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
