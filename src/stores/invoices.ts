import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useDatabase } from '../composables/useDatabase'

export interface InvoiceItem {
  description: string
  category: string
  amount: number
}

export interface Invoice {
  id: string
  vehicleId: string
  workshopName: string
  date: string
  totalAmount: number
  currency: string
  mileageAtService: number
  imageData: string
  rawText: string
  items: InvoiceItem[]
  createdAt: string
  updatedAt: string
}

export const useInvoicesStore = defineStore('invoices', () => {
  const invoices = ref<Invoice[]>([])
  const { dbPromise } = useDatabase()

  async function loadForVehicle(vehicleId: string) {
    const db = await dbPromise
    ;(db as any).invoices.find({ selector: { vehicleId } }).$.subscribe((docs: any[]) => {
      invoices.value = docs.map(d => d.toJSON())
    })
  }

  async function add(invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) {
    const db = await dbPromise
    const now = new Date().toISOString()
    await (db as any).invoices.insert({
      ...invoice,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    })
  }

  async function update(id: string, data: Partial<Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>>) {
    const db = await dbPromise
    const doc = await (db as any).invoices.findOne({ selector: { id } }).exec()
    if (doc)
      await doc.patch({ ...data, updatedAt: new Date().toISOString() })
  }

  async function remove(id: string) {
    const db = await dbPromise
    const doc = await (db as any).invoices.findOne({ selector: { id } }).exec()
    if (doc)
      await doc.remove()
  }

  return { invoices, loadForVehicle, add, update, remove }
})
