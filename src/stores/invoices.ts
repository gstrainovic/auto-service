import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { db, id, tx } from '../lib/instantdb'

export interface InvoiceItem {
  description: string
  category: string
  amount: number
}

export interface Invoice {
  id: string
  vehicleId: string
  workshopName?: string
  date: string
  totalAmount?: number
  currency?: string
  mileageAtService?: number
  imageData?: string
  ocrCacheId?: string
  items?: InvoiceItem[]
  createdAt: string
  updatedAt: string
}

export const useInvoicesStore = defineStore('invoices', () => {
  const invoices = ref<Invoice[]>([])
  const isLoading = ref(true)
  const error = shallowRef<Error | null>(null)
  let unsubscribe: (() => void) | null = null

  function load() {
    if (unsubscribe) return

    isLoading.value = true
    unsubscribe = db.subscribeQuery(
      { invoices: {} },
      (result) => {
        if (result.error) {
          error.value = new Error(result.error.message)
          isLoading.value = false
          return
        }
        if (result.data) {
          invoices.value = (result.data.invoices || []) as Invoice[]
          isLoading.value = false
        }
      },
    )
  }

  function getByVehicleId(vehicleId: string): Invoice[] {
    return invoices.value.filter(i => i.vehicleId === vehicleId)
  }

  async function add(invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString()
    const newId = id()
    await db.transact([
      (tx.invoices as any)[newId].update({
        ...invoice,
        createdAt: now,
        updatedAt: now,
      }),
    ])
    return newId
  }

  async function remove(invoiceId: string) {
    await db.transact([
      (tx.invoices as any)[invoiceId].delete(),
    ])
  }

  async function update(invoiceId: string, data: Partial<Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>>) {
    await db.transact([
      (tx.invoices as any)[invoiceId].update({
        ...data,
        updatedAt: new Date().toISOString(),
      }),
    ])
  }

  return {
    invoices,
    isLoading,
    error,
    load,
    getByVehicleId,
    add,
    remove,
    update,
  }
})
