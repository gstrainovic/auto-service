import { createRxDatabase, removeRxDatabase } from 'rxdb'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { invoiceSchema, maintenanceSchema, vehicleSchema } from './schema'

async function initDatabase(name: string) {
  const db = await createRxDatabase({
    name,
    storage: getRxStorageDexie(),
  })

  await db.addCollections({
    vehicles: { schema: vehicleSchema },
    invoices: { schema: invoiceSchema },
    maintenances: { schema: maintenanceSchema },
  })

  return db
}

export async function createDatabase(name = 'autoservice') {
  try {
    return await initDatabase(name)
  }
  catch (e: any) {
    if (e?.code === 'DB6') {
      console.warn('Schema geändert — Datenbank wird zurückgesetzt.')
      await removeRxDatabase(name, getRxStorageDexie())
      return await initDatabase(name)
    }
    throw e
  }
}
