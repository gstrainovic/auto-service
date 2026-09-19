/**
 * Täglicher Abo-Job für Betriebe mit Jahresrechnung (scripts/billing.ts): wer ist zur Verlängerung fällig und mit wie
 * vielen aktiven Fahrzeugen, welche Rechnungen sind offen, wem gehört eine Zahlungsreferenz. Rechnungen erzeugt und
 * verschickt der AI-Proxy (`/billing/renew`, `/billing/paid`), die Regeln stehen dort in `invoice-subscription.ts`.
 */
import type { InvoiceRecord } from '@strainovic/ai-proxy/invoice'
import type { Subscription } from '@strainovic/ai-proxy/stores/types'
import { openInvoices, renewalDue } from '@strainovic/ai-proxy/invoice-subscription'
import { activeVehicles } from './vehicle-status'

export interface InvoiceEntry {
  userId: string
  sub: Subscription
}

interface OwnedVehicle {
  creatorId: string
  soldAt?: string | null
}

export function dueRenewals(entries: InvoiceEntry[], vehicles: OwnedVehicle[], today: string): { userId: string, company: string, vehicles: number }[] {
  return entries
    .filter(e => renewalDue(e.sub, today))
    .map((e) => {
      const own = vehicles.filter(v => v.creatorId === e.userId).map(v => ({ make: '', model: '', soldAt: v.soldAt }))
      return { userId: e.userId, company: e.sub.billingAddress?.company ?? '', vehicles: Math.max(1, activeVehicles(own, today).length) }
    })
}

export function openInvoiceReport(entries: InvoiceEntry[], today: string): { userId: string, company: string, email: string, invoice: InvoiceRecord, overdue: boolean }[] {
  return entries.flatMap(e => openInvoices(e.sub).map(invoice => ({
    userId: e.userId,
    company: e.sub.billingAddress?.company ?? '',
    email: e.sub.billingAddress?.email ?? '',
    invoice,
    overdue: invoice.dueAt < today,
  })))
}

/** Nutzer zu einer Zahlungsreferenz oder Rechnungsnummer (aus dem Kontoauszug, Leerzeichen egal) */
export function findInvoiceOwner(entries: InvoiceEntry[], key: string): string {
  const wanted = key.replace(/\s/g, '').toUpperCase()
  const owner = entries.find(e => (e.sub.invoices ?? []).some(i => i.reference === wanted || i.number === wanted))
  if (!owner)
    throw new Error(`Keine Rechnung mit Referenz oder Nummer ${key}`)
  return owner.userId
}
