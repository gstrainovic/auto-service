import type { Lead, LeadSegment } from '../lib/leads'
import { defineStore } from 'pinia'
import { db, id, tx } from '../lib/instantdb'
import { leadSchema } from '../lib/leads'

/**
 * Interessenten und Klicks von den Landing Pages, ohne Login geschrieben (Perms: nur create).
 * Ersetzt ein Analytics-Werkzeug: Besucher zählt das Caddy-Log, Klicks `events`, Einträge `leads`.
 */
export const useLeadsStore = defineStore('leads', () => {
  async function add(input: Lead) {
    const lead = leadSchema.parse(input)
    await db.transact([
      (tx.leads as any)[id()].update({
        ...lead,
        createdAt: new Date().toISOString(),
      }),
    ])
  }

  function trackCta(segment: LeadSegment) {
    // Fehler hier dürfen die Seite nicht stören, der Klick zählt nur für die Auswertung
    db.transact([
      (tx.events as any)[id()].update({ name: 'cta_click', segment, createdAt: new Date().toISOString() }),
    ]).catch(() => {})
  }

  return { add, trackCta }
})
