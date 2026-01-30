<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useInvoicesStore } from '../stores/invoices'
import { useMaintenancesStore } from '../stores/maintenances'
import { useVehiclesStore } from '../stores/vehicles'

const route = useRoute()
const vehiclesStore = useVehiclesStore()
const invoicesStore = useInvoicesStore()
const maintenancesStore = useMaintenancesStore()
const tab = ref('maintenance')

const vehicle = computed(() =>
  vehiclesStore.vehicles.find(v => v.id === route.params.id),
)

onMounted(async () => {
  await vehiclesStore.load()
  const id = route.params.id as string
  await invoicesStore.loadForVehicle(id)
  await maintenancesStore.loadForVehicle(id)
})
</script>

<template>
  <q-page padding>
    <q-btn flat icon="arrow_back" to="/vehicles" class="q-mb-md" />

    <template v-if="vehicle">
      <div class="text-h5">
        {{ vehicle.make }} {{ vehicle.model }}
      </div>
      <div class="text-subtitle1">
        {{ vehicle.year }} · {{ vehicle.licensePlate }}
      </div>
      <div class="text-subtitle2 q-mb-lg">
        <q-icon name="speed" /> {{ vehicle.mileage.toLocaleString('de-DE') }} km
      </div>

      <q-tabs v-model="tab" align="left">
        <q-tab name="maintenance" label="Wartung" />
        <q-tab name="invoices" label="Rechnungen" />
      </q-tabs>

      <q-tab-panels v-model="tab">
        <q-tab-panel name="maintenance">
          <q-list bordered separator>
            <q-item v-for="m in maintenancesStore.maintenances" :key="m.id">
              <q-item-section>
                <q-item-label>{{ m.description || m.type }}</q-item-label>
                <q-item-label caption>
                  {{ m.doneAt }} · {{ m.mileageAtService?.toLocaleString('de-DE') }} km
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-tab-panel>

        <q-tab-panel name="invoices">
          <q-list bordered separator>
            <q-item v-for="inv in invoicesStore.invoices" :key="inv.id">
              <q-item-section>
                <q-item-label>{{ inv.workshopName }}</q-item-label>
                <q-item-label caption>
                  {{ inv.date }} · {{ inv.totalAmount?.toFixed(2) }} €
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-tab-panel>
      </q-tab-panels>
    </template>
  </q-page>
</template>
