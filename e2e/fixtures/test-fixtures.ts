import type { Page } from '@playwright/test'
import { test as base } from '@playwright/test'

export interface TestOptions {
  simulateOffline: boolean
}

/**
 * Clears all InstantDB data via the app's client API.
 * Used to ensure clean state before each test.
 */
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
    })

    const txs: any[] = []
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

    if (txs.length > 0)
      await db.transact(txs)
  })

  // Small delay for WebSocket sync
  await page.waitForTimeout(200)
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
    await use(page)
  },
})

export { expect } from '@playwright/test'
