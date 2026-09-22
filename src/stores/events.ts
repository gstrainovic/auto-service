import { defineStore } from 'pinia'
import { db, id, tx } from '../lib/instantdb'

export type LandingSegment = 'betrieb' | 'privathalter'

/** Eigene Adressen aus gedruckten Inseraten: Kampagne und die Seite, auf die sie führt. */
export const CAMPAIGNS = {
  tcs: '/privathalter',
} as const satisfies Record<string, string>

export type Campaign = keyof typeof CAMPAIGNS

const CAMPAIGN_KEY = 'campaign'

/**
 * Klicks von den Landing Pages, ohne Login geschrieben (Perms: nur create).
 * Ersetzt ein Analytics-Werkzeug: Besucher zählt das Caddy-Log, Klicks `events`, Fragen das Postfach.
 * Wer über eine Inserat-Adresse kommt, trägt die Kampagne bis zum Testklick mit (sessionStorage, nur dieser Tab).
 */
export const useEventsStore = defineStore('events', () => {
  function write(event: Record<string, string>) {
    // Fehler hier dürfen die Seite nicht stören, der Eintrag zählt nur für die Auswertung
    db.transact([
      (tx.events as any)[id()].update({ ...event, createdAt: new Date().toISOString() }),
    ]).catch(() => {})
  }

  function campaign(): string | null {
    try {
      return sessionStorage.getItem(CAMPAIGN_KEY)
    }
    catch {
      return null
    }
  }

  function trackVisit(name: Campaign) {
    try {
      sessionStorage.setItem(CAMPAIGN_KEY, name)
    }
    catch {}
    write({ name: 'visit', campaign: name })
  }

  function trackCta(segment: LandingSegment) {
    const current = campaign()
    write({ name: 'cta_click', segment, ...(current ? { campaign: current } : {}) })
  }

  return { trackVisit, trackCta }
})
