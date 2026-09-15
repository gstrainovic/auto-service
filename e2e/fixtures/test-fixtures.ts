import type { Page } from '@playwright/test'
import { test as base } from '@playwright/test'

export interface TestOptions {
  simulateOffline: boolean
}

// Only unfixable third-party errors here — everything else must be fixed, not ignored.
// Tesseract.js WASM runs in a Web Worker — its console.error can't be intercepted from JS.
// The warning fires for images without DPI metadata (all browser-resized images).
const IGNORED_ERRORS = [
  /Invalid resolution.*dpi/,
  // Bewusste 402-Antwort des AI-Proxys bei erreichtem Monatslimit (AP-002)
  /status of 402 \(Payment Required\)/,
]

/**
 * Clears all InstantDB data via the app's client API.
 * Used to ensure clean state before each test.
 */
/** Zählt Entitäten direkt in InstantDB (Endzustand statt KI-Text prüfen). */
export async function countEntities(page: Page, entity: string): Promise<number> {
  return page.evaluate(async (name) => {
    const idb = (window as any).__instantdb
    if (!idb)
      return 0
    const result = await idb.db.queryOnce({ [name]: {} })
    return (result.data[name] || []).length
  }, entity)
}

/** Wartet bis mindestens eine Entität existiert, gibt false zurück wenn nicht innerhalb timeoutMs. */
export async function waitForEntity(page: Page, entity: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await countEntities(page, entity) > 0)
      return true
    await page.waitForTimeout(500)
  }
  return false
}

export const SCAN_INVOICE = {
  workshopName: 'Lucky Car Dornbirn',
  date: '2025-04-15',
  totalAmount: 1403.34,
  currency: 'EUR',
  mileageAtService: 252586,
  items: [
    { description: 'Motoröl wechseln', category: 'inspektion', amount: 180 },
    { description: 'Auspuff reparieren', category: 'sonstiges', amount: 1100 },
  ],
}

/**
 * Beleg-Scan ohne echte Mistral-Aufrufe: OCR und strukturierte Auswertung des AI-Proxys abfangen.
 * Fotos: jede Auswertung liefert der Reihe nach einen Eintrag aus `photos` (Standard: SCAN_INVOICE).
 * PDFs: die OCR liefert eine Seite pro Eintrag in `pdfPages` (Text «MOCK-SEITE-n»), die Seitenauswertung den
 * passenden Eintrag; `kind` ist rechnung (Standard), fortsetzung oder andere. `ocrStatus` simuliert Fehler.
 */
export async function mockInvoiceScan(page: Page, opts: {
  photos?: Record<string, unknown>[]
  pdfPages?: Record<string, unknown>[]
  ocrStatus?: number
  ocrError?: string
} = {}) {
  const photos = opts.photos ?? [SCAN_INVOICE]
  const pdfPages = (opts.pdfPages ?? [SCAN_INVOICE]).map(p => ({ kind: 'rechnung', ...p }))
  let photoCall = 0
  await page.route('**/localhost:8787/v1/ocr', (route) => {
    if (opts.ocrStatus)
      return route.fulfill({ status: opts.ocrStatus, contentType: 'application/json', body: JSON.stringify({ error: { message: opts.ocrError ?? 'Fehler' } }) })
    const isPdf = (route.request().postData() ?? '').includes('document_url')
    const pages = isPdf
      ? pdfPages.map((_, i) => ({ markdown: `MOCK-SEITE-${i + 1}` }))
      : [{ markdown: 'Lucky Car Dornbirn\nRechnung 15.04.2025\nTotal EUR 1403.34' }]
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ pages }) })
  })
  await page.route('**/localhost:8787/v1/chat/completions', (route) => {
    const pageNo = /MOCK-SEITE-(\d+)/.exec(route.request().postData() ?? '')?.[1]
    const content = pageNo ? pdfPages[Number(pageNo) - 1] : photos[photoCall++ % photos.length]
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'mock',
        object: 'chat.completion',
        created: 0,
        model: 'mistral-small-latest',
        choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(content) } }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      }),
    })
  })
}

export async function clearInstantDB(page: Page) {
  // Navigate to app first to initialize InstantDB client
  await page.goto('/')

  // Wait for InstantDB to be ready
  await page.waitForFunction(() => !!(window as any).__instantdb, { timeout: 30000 })

  // Use InstantDB client to delete all entities
  await page.evaluate(async () => {
    const idb = (window as any).__instantdb
    if (!idb)
      return

    const { db, tx } = idb
    const result = await db.queryOnce({
      vehicles: {},
      invoices: {},
      maintenances: {},
      chatmessages: {},
      ocrcache: {},
      usage: {},
      subscriptions: {},
      settings: {},
    })
    const txs: any[] = []
    for (const s of result.data.settings || [])
      txs.push(tx.settings[s.id].delete())
    for (const v of result.data.vehicles || [])
      txs.push(tx.vehicles[v.id].delete())
    for (const i of result.data.invoices || [])
      txs.push(tx.invoices[i.id].delete())
    for (const m of result.data.maintenances || [])
      txs.push(tx.maintenances[m.id].delete())
    for (const c of result.data.chatmessages || [])
      txs.push(tx.chatmessages[c.id].delete())
    for (const o of result.data.ocrcache || [])
      txs.push(tx.ocrcache[o.id].delete())
    // Nutzungszähler/Abos des AI-Proxys: jeder Test startet im Free-Plan bei null
    for (const u of result.data.usage || [])
      txs.push(tx.usage[u.id].delete())
    for (const s of result.data.subscriptions || [])
      txs.push(tx.subscriptions[s.id].delete())

    if (txs.length > 0)
      await db.transact(txs)
  })

  // Small delay for WebSocket sync
  await page.waitForTimeout(200)
}

function isIgnoredError(msg: string, offline: boolean): boolean {
  if (offline)
    return true // All console errors expected in offline mode
  return IGNORED_ERRORS.some(pattern => pattern.test(msg))
}

export const test = base.extend<TestOptions>({
  simulateOffline: [false, { option: true }],

  page: async ({ page, simulateOffline }, use) => {
    if (simulateOffline) {
      // Block all InstantDB server requests to simulate offline mode
      // This tests that the app works with IndexedDB-only (no server sync)
      await page.route('**/localhost:8888/**', route => route.abort('connectionrefused'))
      await page.route('**/127.0.0.1:8888/**', route => route.abort('connectionrefused'))
    }

    // Collect console errors and uncaught exceptions
    const consoleErrors: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        if (!isIgnoredError(text, simulateOffline))
          consoleErrors.push(`[console.error] ${text}`)
      }
    })

    page.on('pageerror', (error) => {
      const text = error.message || String(error)
      if (!isIgnoredError(text, simulateOffline))
        consoleErrors.push(`[pageerror] ${text}`)
    })

    await use(page)

    // After test: fail if unexpected console errors occurred
    if (consoleErrors.length > 0) {
      throw new Error(
        `Test produced ${consoleErrors.length} unexpected console error(s):\n${consoleErrors.join('\n')}`,
      )
    }
  },
})

export { expect } from '@playwright/test'
