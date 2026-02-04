import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { db, id, tx } from '../lib/instantdb'

export interface Maintenance {
  id: string
  vehicleId: string
  invoiceId?: string
  type: string
  description?: string
  doneAt: string
  mileageAtService: number
  nextDueDate?: string
  nextDueMileage?: number
  status: 'done' | 'due' | 'overdue'
  createdAt: string
  updatedAt: string
}

export const useMaintenancesStore = defineStore('maintenances', () => {
  const maintenances = ref<Maintenance[]>([])
  const isLoading = ref(true)
  const error = shallowRef<Error | null>(null)
  let unsubscribe: (() => void) | null = null

  function load(): void {
    if (unsubscribe)
      return

    isLoading.value = true
    unsubscribe = db.subscribeQuery(
      { maintenances: {} },
      (result) => {
        if (result.error) {
          error.value = new Error(result.error.message)
          isLoading.value = false
          return
        }
        if (result.data) {
          maintenances.value = (result.data.maintenances || []) as Maintenance[]
          isLoading.value = false
        }
      },
    )
  }

  function getByVehicleId(vehicleId: string): Maintenance[] {
    return maintenances.value.filter(m => m.vehicleId === vehicleId)
  }

  // Compat-Methode: lädt einfach alle und filtert dann (InstantDB ist reaktiv)
  async function loadForVehicle(_vehicleId: string) {
    load()
  }

  async function add(maintenance: Omit<Maintenance, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = new Date().toISOString()
    const newId = id()
    await db.transact([
      (tx.maintenances as any)[newId].update({
        ...maintenance,
        createdAt: now,
        updatedAt: now,
      }),
    ])
    return newId
  }

  async function remove(maintenanceId: string): Promise<void> {
    await db.transact([
      (tx.maintenances as any)[maintenanceId].delete(),
    ])
  }

  async function removeByVehicleAndType(vehicleId: string, type: string): Promise<void> {
    const toRemove = maintenances.value.filter(
      m => m.vehicleId === vehicleId && m.type === type,
    )
    if (toRemove.length === 0)
      return

    await db.transact(
      toRemove.map(m => (tx.maintenances as any)[m.id].delete()),
    )
  }

  async function update(maintenanceId: string, data: Partial<Omit<Maintenance, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    await db.transact([
      (tx.maintenances as any)[maintenanceId].update({
        ...data,
        updatedAt: new Date().toISOString(),
      }),
    ])
  }

  return {
    maintenances,
    isLoading,
    error,
    load,
    loadForVehicle,
    getByVehicleId,
    add,
    remove,
    removeByVehicleAndType,
    update,
  }
})
