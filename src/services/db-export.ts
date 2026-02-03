import { db, tx } from '../lib/instantdb'

interface ExportData {
  version: number
  exportedAt: string
  vehicles: any[]
  invoices: any[]
  maintenances: any[]
  ocrCache: any[]
  chatmessages: any[]
}

export async function exportDatabase(): Promise<string> {
  const result = await db.queryOnce({
    vehicles: {},
    invoices: {},
    maintenances: {},
    ocrcache: {},
    chatmessages: {},
  })

  const data: ExportData = {
    version: 2,
    exportedAt: new Date().toISOString(),
    vehicles: result.data.vehicles || [],
    invoices: result.data.invoices || [],
    maintenances: result.data.maintenances || [],
    ocrCache: result.data.ocrcache || [],
    chatmessages: result.data.chatmessages || [],
  }

  return JSON.stringify(data, null, 2)
}

export async function importDatabase(json: string): Promise<{ imported: Record<string, number> }> {
  const data: ExportData = JSON.parse(json)

  if (!data.version || !data.exportedAt)
    throw new Error('Ungültiges Export-Format')

  const imported: Record<string, number> = {}

  const collections: { key: keyof Pick<ExportData, 'vehicles' | 'invoices' | 'maintenances' | 'ocrCache' | 'chatmessages'>, entity: string }[] = [
    { key: 'vehicles', entity: 'vehicles' },
    { key: 'invoices', entity: 'invoices' },
    { key: 'maintenances', entity: 'maintenances' },
    { key: 'ocrCache', entity: 'ocrcache' },
    { key: 'chatmessages', entity: 'chatmessages' },
  ]

  for (const { key, entity } of collections) {
    const docs = data[key] || []
    const transactions: any[] = []
    for (const doc of docs) {
      if (doc.id) {
        const { id, ...rest } = doc
        transactions.push((tx as any)[entity][id].update(rest))
      }
    }
    if (transactions.length) {
      try {
        await db.transact(transactions)
        imported[key] = transactions.length
      }
      catch {
        imported[key] = 0
      }
    }
    else {
      imported[key] = 0
    }
  }

  return { imported }
}
