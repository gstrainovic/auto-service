import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
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
  createdAt: string
  updatedAt: string
}

export const useVehiclesStore = defineStore('vehicles', () => {
  const vehicles = ref<Vehicle[]>([])
  const isLoading = ref(true)
  const error = shallowRef<Error | null>(null)
  let unsubscribe: (() => void) | null = null

  function load() {
    if (unsubscribe) return

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
          vehicles.value = (result.data.vehicles || []) as Vehicle[]
          isLoading.value = false
        }
      },
    )
  }

  async function add(vehicle: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString()
    const newId = id()
    await db.transact([
      (tx.vehicles as any)[newId].update({
        ...vehicle,
        createdAt: now,
        updatedAt: now,
      }),
    ])
  }

  async function remove(vehicleId: string) {
    await db.transact([
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
    update,
    updateMileage,
    updateCustomSchedule,
  }
})
