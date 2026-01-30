<script setup lang="ts">
import type { DueResult } from '../services/maintenance-schedule'
import { onMounted, ref, watch } from 'vue'
import { useDatabase } from '../composables/useDatabase'
import { checkDueMaintenances, getMaintenanceSchedule } from '../services/maintenance-schedule'
import { useVehiclesStore } from '../stores/vehicles'

const vehiclesStore = useVehiclesStore()
const dueMap = ref<Record<string, DueResult[]>>({})
const { dbPromise } = useDatabase()

onMounted(async () => {
  await vehiclesStore.load()
  await computeDue()
})

watch(() => vehiclesStore.vehicles, computeDue, { deep: true })

async function computeDue() {
  const db = await dbPromise
  for (const vehicle of vehiclesStore.vehicles) {
    const schedule = getMaintenanceSchedule(vehicle.make, vehicle.model)
    const mDocs = await (db as any).maintenances.find({ selector: { vehicleId: vehicle.id } }).exec()
    const lastMaintenances = mDocs.map((d: any) => ({
      type: d.type,
      mileageAtService: d.mileageAtService,
      doneAt: d.doneAt,
    }))

    dueMap.value[vehicle.id] = checkDueMaintenances({
      currentMileage: vehicle.mileage,
      lastMaintenances,
      schedule,
    })
  }
}
</script>

<template>
  <q-page padding>
    <h5>Dashboard</h5>

    <div v-if="vehiclesStore.vehicles.length === 0" class="text-center q-pa-xl text-grey">
      <q-icon name="directions_car" size="64px" />
      <div class="q-mt-md">
        Füge dein erstes Fahrzeug hinzu um loszulegen.
      </div>
      <q-btn color="primary" to="/vehicles" label="Fahrzeuge" class="q-mt-md" />
    </div>

    <div v-for="vehicle in vehiclesStore.vehicles" :key="vehicle.id" class="q-mb-lg">
      <div class="text-h6">
        {{ vehicle.make }} {{ vehicle.model }}
      </div>
      <div class="text-subtitle2 q-mb-sm">
        {{ vehicle.mileage.toLocaleString('de-DE') }} km · {{ vehicle.licensePlate }}
      </div>

      <q-list v-if="dueMap[vehicle.id]?.length" bordered separator>
        <q-item v-for="item in dueMap[vehicle.id]" :key="item.type">
          <q-item-section avatar>
            <q-icon
              :name="item.status === 'overdue' ? 'warning' : item.status === 'due' ? 'schedule' : 'check_circle'"
              :color="item.status === 'overdue' ? 'negative' : item.status === 'due' ? 'warning' : 'positive'"
            />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ item.label }}</q-item-label>
            <q-item-label v-if="item.lastDoneAt" caption>
              Zuletzt: {{ item.lastDoneAt }} bei {{ item.lastMileage?.toLocaleString('de-DE') }} km
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-badge :color="item.status === 'overdue' ? 'negative' : item.status === 'due' ? 'warning' : 'positive'">
              {{ item.status === 'overdue' ? 'Überfällig' : item.status === 'due' ? 'Fällig' : 'OK' }}
            </q-badge>
          </q-item-section>
        </q-item>
      </q-list>
    </div>
  </q-page>
</template>
