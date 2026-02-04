import type { Page } from '@playwright/test'

/**
 * Clears all InstantDB data via the app's client API.
 * This ensures WebSocket subscribers get notified of deletions.
 */
export async function clearInstantDB(page: Page) {
  // Navigate to app first to initialize InstantDB client
  await page.goto('/')

  // Use InstantDB client to delete all entities
  // This triggers proper WebSocket notifications to all subscribers
  await page.evaluate(async () => {
    const idb = (window as any).__instantdb
    if (!idb)
      return

    const { db, tx } = idb

    // Query all entities
    const result = await db.queryOnce({
      vehicles: {},
      invoices: {},
      maintenances: {},
      chatmessages: {},
      ocrcache: {},
    })

    const txs: any[] = []

    // Delete all entities of each type
    for (const vehicle of result.data.vehicles || [])
      txs.push(tx.vehicles[vehicle.id].delete())
    for (const invoice of result.data.invoices || [])
      txs.push(tx.invoices[invoice.id].delete())
    for (const maintenance of result.data.maintenances || [])
      txs.push(tx.maintenances[maintenance.id].delete())
    for (const msg of result.data.chatmessages || [])
      txs.push(tx.chatmessages[msg.id].delete())
    for (const ocr of result.data.ocrcache || [])
      txs.push(tx.ocrcache[ocr.id].delete())

    if (txs.length > 0)
      await db.transact(txs)
  })

  // Small delay for WebSocket sync to propagate
  await page.waitForTimeout(200)
}
