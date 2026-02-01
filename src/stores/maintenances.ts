import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useDatabase } from '../composables/useDatabase'

export interface Maintenance {
  id: string
  vehicleId: string
  invoiceId: string
  type: string
  description: string
  doneAt: string
  mileageAtService: number
  nextDueDate: string
  nextDueMileage: number
  status: 'done' | 'due' | 'overdue'
  createdAt: string
  updatedAt: string
}

export const useMaintenancesStore = defineStore('maintenances', () => {
  const maintenances = ref<Maintenance[]>([])
  const { dbPromise } = useDatabase()

  const overdue = computed(() =>
    maintenances.value.filter(m => m.status === 'overdue'),
  )

  const due = computed(() =>
    maintenances.value.filter(m => m.status === 'due'),
  )

  async function loadForVehicle(vehicleId: string) {
    const db = await dbPromise
    ;(db as any).maintenances.find({ selector: { vehicleId } }).$.subscribe((docs: any[]) => {
      maintenances.value = docs.map(d => d.toJSON())
    })
  }

  async function add(maintenance: Omit<Maintenance, 'id' | 'createdAt' | 'updatedAt'>) {
    const db = await dbPromise
    const now = new Date().toISOString()
    await (db as any).maintenances.insert({
      ...maintenance,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    })
  }

  async function updateStatus(id: string, status: Maintenance['status']) {
    const db = await dbPromise
    const doc = await (db as any).maintenances.findOne({ selector: { id } }).exec()
    if (doc)
      await doc.patch({ status, updatedAt: new Date().toISOString() })
  }

  async function update(id: string, data: Partial<Omit<Maintenance, 'id' | 'createdAt' | 'updatedAt'>>) {
    const db = await dbPromise
    const doc = await (db as any).maintenances.findOne({ selector: { id } }).exec()
    if (doc)
      await doc.patch({ ...data, updatedAt: new Date().toISOString() })
  }

  async function remove(id: string) {
    const db = await dbPromise
    const doc = await (db as any).maintenances.findOne({ selector: { id } }).exec()
    if (doc)
      await doc.remove()
  }

  return { maintenances, overdue, due, loadForVehicle, add, update, updateStatus, remove }
})
