import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { getCurrentUserId } from '../composables/useAuth'
import { db, id, tx } from '../lib/instantdb'

export interface VehicleScheduleItem {
  type: string
  label: string
  intervalKm: number
  intervalMonths: number
}

export interface Vehicle {
  id: string
  make: string
  model: string
  year: number
  mileage: number
  vin?: string
  licensePlate: string
  customSchedule?: VehicleScheduleItem[]
  /** Tag der Übergabe beim Verkauf; gesetzt heisst: raus aus Fälligkeiten, drin in Kosten und Exporten */
  soldAt?: string | null
  soldMileage?: number | null
  /** Einrichtungs-Checkliste auf der Fahrzeugseite ausgeblendet */
  setupHidden?: boolean
  createdAt: string
  updatedAt: string
}

export const useVehiclesStore = defineStore('vehicles', () => {
  const vehicles = ref<Vehicle[]>([])
  const isLoading = ref(true)
  const error = shallowRef<Error | null>(null)
  let unsubscribe: (() => void) | null = null

  function load() {
    if (unsubscribe)
      return

    isLoading.value = true
    error.value = null

    unsubscribe = db.subscribeQuery(
      { vehicles: {} },
      (result) => {
        if (result.error) {
          error.value = new Error(result.error.message)
          isLoading.value = false
          return
        }
        if (result.data) {
          // Feste Reihenfolge: InstantDB liefert Cache und Server-Antwort nicht in derselben Ordnung, ohne Sortierung
          // springen die Fahrzeuge im Dashboard nach dem ersten Rendern um (Deep-Link #fahrzeug-<id> zielt daneben)
          vehicles.value = ((result.data.vehicles || []) as Vehicle[])
            .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.id.localeCompare(b.id))
          isLoading.value = false
        }
      },
    )
  }

  async function add(vehicle: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = new Date().toISOString()
    const newId = id()
    await db.transact([
      (tx.vehicles as any)[newId].update({
        ...vehicle,
        creatorId: getCurrentUserId(),
        createdAt: now,
        updatedAt: now,
      }),
    ])
    return newId
  }

  async function remove(vehicleId: string) {
    await db.transact([
      (tx.vehicles as any)[vehicleId].delete(),
    ])
  }

  /** Löscht das Fahrzeug samt Rechnungen und Wartungen in einer Transaktion (Detailseite und Karte nutzen dieselbe Kaskade) */
  async function removeWithRelated(vehicleId: string) {
    const result = await db.queryOnce({ invoices: {}, maintenances: {} })
    const invoices = (result.data.invoices || []) as { id: string, vehicleId?: string }[]
    const maintenances = (result.data.maintenances || []) as { id: string, vehicleId?: string }[]
    await db.transact([
      ...invoices.filter(i => i.vehicleId === vehicleId).map(i => (tx.invoices as any)[i.id].delete()),
      ...maintenances.filter(m => m.vehicleId === vehicleId).map(m => (tx.maintenances as any)[m.id].delete()),
      (tx.vehicles as any)[vehicleId].delete(),
    ])
  }

  async function update(vehicleId: string, data: Partial<Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>>) {
    await db.transact([
      (tx.vehicles as any)[vehicleId].update({
        ...data,
        updatedAt: new Date().toISOString(),
      }),
    ])
  }

  async function updateMileage(vehicleId: string, mileage: number) {
    await update(vehicleId, { mileage })
  }

  async function updateCustomSchedule(vehicleId: string, schedule: VehicleScheduleItem[]) {
    await update(vehicleId, { customSchedule: schedule })
  }

  return {
    vehicles,
    isLoading,
    error,
    load,
    add,
    remove,
    removeWithRelated,
    update,
    updateMileage,
    updateCustomSchedule,
  }
})
