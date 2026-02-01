import { createRxDatabase, removeRxDatabase } from 'rxdb'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { chatMessageSchema, invoiceSchema, maintenanceSchema, ocrCacheSchema, vehicleSchema } from './schema'

export async function createDatabase(name = 'autoservice') {
  const storage = getRxStorageDexie()
  const db = await createRxDatabase({ name, storage })

  try {
    await db.addCollections({
      vehicles: { schema: vehicleSchema },
      invoices: { schema: invoiceSchema },
      maintenances: { schema: maintenanceSchema },
      ocrcache: { schema: ocrCacheSchema },
      chatmessages: { schema: chatMessageSchema },
    })
    return db
  }
  catch (e: any) {
    if (e?.code === 'DB6') {
      console.warn('Schema geändert — Datenbank wird zurückgesetzt.')
      await db.destroy()
      await removeRxDatabase(name, storage)
      const freshDb = await createRxDatabase({ name, storage })
      await freshDb.addCollections({
        vehicles: { schema: vehicleSchema },
        invoices: { schema: invoiceSchema },
        maintenances: { schema: maintenanceSchema },
        chatmessages: { schema: chatMessageSchema },
      })
      return freshDb
    }
    throw e
  }
}
