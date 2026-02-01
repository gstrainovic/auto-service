import type { RxDatabase } from 'rxdb'

interface ExportData {
  version: number
  exportedAt: string
  vehicles: any[]
  invoices: any[]
  maintenances: any[]
  ocrCache: any[]
}

export async function exportDatabase(db: RxDatabase): Promise<string> {
  const vehicles = await (db as any).vehicles.find().exec()
  const invoices = await (db as any).invoices.find().exec()
  const maintenances = await (db as any).maintenances.find().exec()
  const ocrCache = await (db as any).ocrcache.find().exec()

  const data: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    vehicles: vehicles.map((d: any) => d.toJSON()),
    invoices: invoices.map((d: any) => d.toJSON()),
    maintenances: maintenances.map((d: any) => d.toJSON()),
    ocrCache: ocrCache.map((d: any) => d.toJSON()),
  }

  return JSON.stringify(data, null, 2)
}

export async function importDatabase(db: RxDatabase, json: string): Promise<{ imported: Record<string, number> }> {
  const data: ExportData = JSON.parse(json)

  if (!data.version || !data.exportedAt)
    throw new Error('Ungültiges Export-Format')

  const imported: Record<string, number> = {}

  const collections: { key: keyof Pick<ExportData, 'vehicles' | 'invoices' | 'maintenances' | 'ocrCache'>, name: string }[] = [
    { key: 'vehicles', name: 'vehicles' },
    { key: 'invoices', name: 'invoices' },
    { key: 'maintenances', name: 'maintenances' },
    { key: 'ocrCache', name: 'ocrcache' },
  ]

  for (const { key, name } of collections) {
    const docs = data[key] || []
    let count = 0
    for (const doc of docs) {
      try {
        await (db as any)[name].upsert(doc)
        count++
      }
      catch {}
    }
    imported[key] = count
  }

  return { imported }
}
