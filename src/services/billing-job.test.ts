import type { Subscription } from '@strainovic/ai-proxy/stores/types'
import { orderSubscription } from '@strainovic/ai-proxy/invoice-subscription'
import { describe, expect, it } from 'vitest'
import { dueRenewals, findInvoiceOwner, openInvoiceReport } from './billing-job'

const IBAN = 'CH93 0076 2011 6238 5295 7'
const address = { company: 'Muster AG', contact: 'Petra Muster', street: 'Hauptstrasse 12', zip: '9000', city: 'St. Gallen', email: 'b@muster.ch' }

function ordered(userId: string, today: string, vehicles = 2): Subscription {
  const result = orderSubscription({ existing: null, order: { ...address, vehicles }, userId, today, iban: IBAN })
  if ('error' in result)
    throw new Error(result.error)
  return result.sub
}

const vehicles = [
  { creatorId: 'u1', soldAt: null },
  { creatorId: 'u1', soldAt: null },
  { creatorId: 'u1', soldAt: '2027-01-05' },
  { creatorId: 'u1', soldAt: null },
  { creatorId: 'u2', soldAt: null },
]

describe('dueRenewals', () => {
  it('fällige Abos mit der Zahl der aktiven Fahrzeuge des Nutzers', () => {
    const entries = [{ userId: 'u1', sub: ordered('u1', '2026-09-19') }]
    // drei aktiv, das verkaufte zählt nicht
    expect(dueRenewals(entries, vehicles, '2027-08-20')).toEqual([{ userId: 'u1', company: 'Muster AG', vehicles: 3 }])
  })

  it('lässt nicht fällige und gekündigte Abos aus', () => {
    const canceled = { ...ordered('u2', '2026-09-19'), cancelAtPeriodEnd: true }
    const entries = [{ userId: 'u1', sub: ordered('u1', '2026-12-01') }, { userId: 'u2', sub: canceled }]
    expect(dueRenewals(entries, vehicles, '2027-08-20')).toEqual([])
  })

  it('ohne aktive Fahrzeuge wird ein Fahrzeug abgerechnet', () => {
    const entries = [{ userId: 'u3', sub: ordered('u3', '2026-09-19') }]
    expect(dueRenewals(entries, vehicles, '2027-08-20')[0]!.vehicles).toBe(1)
  })
})

describe('openInvoiceReport', () => {
  it('listet offene Rechnungen mit Firma und markiert überfällige', () => {
    const entries = [{ userId: 'u1', sub: ordered('u1', '2026-09-19') }, { userId: 'u2', sub: ordered('u2', '2026-10-01') }]
    const report = openInvoiceReport(entries, '2026-10-25')
    expect(report.map(r => [r.userId, r.company, r.overdue])).toEqual([['u1', 'Muster AG', true], ['u2', 'Muster AG', false]])
  })
})

describe('findInvoiceOwner', () => {
  it('findet den Nutzer über Referenz oder Nummer, Leerzeichen egal', () => {
    const entries = [{ userId: 'u1', sub: ordered('u1', '2026-09-19') }, { userId: 'u2', sub: ordered('u2', '2026-09-19') }]
    const invoice = entries[1]!.sub.invoices![0]!
    expect(findInvoiceOwner(entries, invoice.reference.replace(/(.{4})/g, '$1 '))).toBe('u2')
    expect(findInvoiceOwner(entries, invoice.number)).toBe('u2')
  })

  it('unbekannte Referenz wirft mit klarer Meldung', () => {
    const entries = [{ userId: 'u1', sub: ordered('u1', '2026-09-19') }]
    expect(() => findInvoiceOwner(entries, 'RF00NIX')).toThrow(/RF00NIX/)
  })
})
