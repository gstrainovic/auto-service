import type { CamtCredit } from '@strainovic/ai-proxy/camt'
import type { Subscription } from '@strainovic/ai-proxy/stores/types'
import { markInvoicePaid, orderSubscription } from '@strainovic/ai-proxy/invoice-subscription'
import { describe, expect, it } from 'vitest'
import { dueRenewals, findInvoiceOwner, matchCredits, openInvoiceReport } from './billing-job'

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

describe('matchCredits', () => {
  const credit = (over: Partial<CamtCredit>): CamtCredit => ({
    reference: '',
    referenceType: 'QRR',
    amount: 72,
    currency: 'CHF',
    bookedAt: '2026-10-12',
    bankRef: 'B-1',
    debtor: 'Muster AG',
    ultimateDebtor: '',
    message: '',
    charges: 0,
    ...over,
  })

  it('ordnet eine Gutschrift der Rechnung und ihrem Nutzer zu', () => {
    const entries = [{ userId: 'u1', sub: ordered('u1', '2026-09-19') }]
    const invoice = entries[0]!.sub.invoices![0]!
    const [match] = matchCredits(entries, [credit({ reference: invoice.reference, amount: invoice.amount })])
    expect(match).toMatchObject({ userId: 'u1', invoice: { number: invoice.number } })
    expect(match!.problem).toBeUndefined()
  })

  it('meldet eine Gutschrift ohne passende Rechnung, statt sie zu buchen', () => {
    const entries = [{ userId: 'u1', sub: ordered('u1', '2026-09-19') }]
    const [match] = matchCredits(entries, [credit({ reference: 'RF00NIX' })])
    expect(match!.userId).toBeUndefined()
    expect(match!.problem).toMatch(/Rechnung/)
  })

  it('meldet einen abweichenden Betrag und eine Gutschrift ohne Referenz', () => {
    const entries = [{ userId: 'u1', sub: ordered('u1', '2026-09-19') }]
    const invoice = entries[0]!.sub.invoices![0]!
    const matches = matchCredits(entries, [
      credit({ reference: invoice.reference, amount: invoice.amount - 10 }),
      credit({ reference: '', bankRef: 'B-2' }),
    ])
    expect(matches[0]!.problem).toMatch(/Betrag/)
    expect(matches[0]!.userId).toBeUndefined()
    expect(matches[1]!.problem).toMatch(/Referenz/)
  })

  it('meldet eine bereits verbuchte Buchung', () => {
    const sub = ordered('u1', '2026-09-19')
    const invoice = sub.invoices![0]!
    const paid = markInvoicePaid(sub, invoice.reference, '2026-10-02', { bankRef: 'B-1' })
    const [match] = matchCredits([{ userId: 'u1', sub: paid }], [credit({ reference: invoice.reference, amount: invoice.amount })])
    expect(match!.problem).toMatch(/bereits|bezahlt/)
    expect(match!.userId).toBeUndefined()
  })
})
