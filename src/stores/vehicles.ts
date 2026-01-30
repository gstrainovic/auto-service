import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useDatabase } from '../composables/useDatabase'

export interface Vehicle {
  id: string
  make: string
  model: string
  year: number
  mileage: number
  vin: string
  licensePlate: string
  createdAt: string
  updatedAt: string
}

export const useVehiclesStore = defineStore('vehicles', () => {
  const vehicles = ref<Vehicle[]>([])
  const { dbPromise } = useDatabase()

  async function load() {
    const db = await dbPromise
    const docs = await (db as any).vehicles.find().exec()
    vehicles.value = docs.map((d: any) => d.toJSON())

    ;(db as any).vehicles.find().$.subscribe((docs: any[]) => {
      vehicles.value = docs.map(d => d.toJSON())
    })
  }

  async function add(vehicle: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>) {
    const db = await dbPromise
    const now = new Date().toISOString()
    await (db as any).vehicles.insert({
      ...vehicle,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    })
  }

  async function remove(id: string) {
    const db = await dbPromise
    const doc = await (db as any).vehicles.findOne({ selector: { id } }).exec()
    if (doc)
      await doc.remove()
  }

  async function updateMileage(id: string, mileage: number) {
    const db = await dbPromise
    const doc = await (db as any).vehicles.findOne({ selector: { id } }).exec()
    if (doc)
      await doc.patch({ mileage, updatedAt: new Date().toISOString() })
  }

  return { vehicles, load, add, remove, updateMileage }
})
