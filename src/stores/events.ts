import { defineStore } from 'pinia'
import { db, id, tx } from '../lib/instantdb'

export type LandingSegment = 'betrieb' | 'privathalter'

/**
 * Klicks von den Landing Pages, ohne Login geschrieben (Perms: nur create).
 * Ersetzt ein Analytics-Werkzeug: Besucher zählt das Caddy-Log, Klicks `events`, Fragen das Postfach.
 */
export const useEventsStore = defineStore('events', () => {
  function trackCta(segment: LandingSegment) {
    // Fehler hier dürfen die Seite nicht stören, der Klick zählt nur für die Auswertung
    db.transact([
      (tx.events as any)[id()].update({ name: 'cta_click', segment, createdAt: new Date().toISOString() }),
    ]).catch(() => {})
  }

  return { trackCta }
})
