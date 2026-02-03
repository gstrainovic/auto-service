<script setup lang="ts">
import type { DueResult } from '../services/maintenance-schedule'
import { onMounted, ref, watch } from 'vue'
import { db, tx } from '../lib/instantdb'
import { checkDueMaintenances, getMaintenanceSchedule } from '../services/maintenance-schedule'
import { useVehiclesStore } from '../stores/vehicles'

const vehiclesStore = useVehiclesStore()
const dueMap = ref<Record<string, DueResult[]>>({})
const confirmDelete = ref<{ vehicleId: string, type: string, label: string } | null>(null)

onMounted(async () => {
  await vehiclesStore.load()
  await computeDue()
})

watch(() => vehiclesStore.vehicles, computeDue, { deep: true })

async function computeDue() {
  const result = await db.queryOnce({ maintenances: {} })
  const allMaintenances = result.data.maintenances || []

  for (const vehicle of vehiclesStore.vehicles) {
    const schedule = getMaintenanceSchedule(vehicle.customSchedule as any)
    const vehicleMaintenances = allMaintenances.filter((m: any) => m.vehicleId === vehicle.id)
    const lastMaintenances = vehicleMaintenances.map((m: any) => ({
      type: m.type,
      mileageAtService: m.mileageAtService,
      doneAt: m.doneAt,
    }))

    dueMap.value[vehicle.id] = checkDueMaintenances({
      currentMileage: vehicle.mileage,
      lastMaintenances,
      schedule,
    })
  }
}

async function deleteMaintenance(vehicleId: string, type: string) {
  const result = await db.queryOnce({ maintenances: {} })
  const maintenances = (result.data.maintenances || [])
    .filter((m: any) => m.vehicleId === vehicleId && m.type === type)
  if (maintenances.length) {
    await db.transact(maintenances.map((m: any) => tx.maintenances[m.id].delete()))
  }
  confirmDelete.value = null
  await computeDue()
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

      <q-banner v-if="!vehicle.customSchedule?.length" class="bg-warning text-white q-mb-sm schedule-hint" rounded dense>
        <template #avatar>
          <q-icon name="info" size="xs" />
        </template>
        Allgemeine Wartungsintervalle — Service-Heft im Chat hochladen für genaue Intervalle.
      </q-banner>

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
            <div class="row items-center q-gutter-xs">
              <q-badge :color="item.status === 'overdue' ? 'negative' : item.status === 'due' ? 'warning' : 'positive'">
                {{ item.status === 'overdue' ? 'Überfällig' : item.status === 'due' ? 'Fällig' : 'OK' }}
              </q-badge>
              <q-btn
                v-if="item.lastDoneAt"
                flat
                round
                dense
                size="sm"
                icon="delete"
                color="grey"
                @click="confirmDelete = { vehicleId: vehicle.id, type: item.type, label: item.label }"
              />
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </div>

    <q-dialog :model-value="!!confirmDelete" @update:model-value="confirmDelete = null">
      <q-card>
        <q-card-section>
          <div class="text-h6">
            Wartungseintrag löschen?
          </div>
        </q-card-section>
        <q-card-section>
          Alle Einträge für <strong>{{ confirmDelete?.label }}</strong> werden gelöscht.
          Diese Aktion kann nicht rückgängig gemacht werden.
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Abbrechen" @click="confirmDelete = null" />
          <q-btn
            color="negative"
            label="Löschen"
            @click="confirmDelete && deleteMaintenance(confirmDelete.vehicleId, confirmDelete.type)"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>
