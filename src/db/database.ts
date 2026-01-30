import { createRxDatabase } from 'rxdb'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { invoiceSchema, maintenanceSchema, vehicleSchema } from './schema'

export async function createDatabase(name = 'autoservice') {
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
