<script setup lang="ts">
import type { Invoice } from '../stores/invoices'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDatabase } from '../composables/useDatabase'
import { useInvoicesStore } from '../stores/invoices'
import { useMaintenancesStore } from '../stores/maintenances'
import { useVehiclesStore } from '../stores/vehicles'

const route = useRoute()
const router = useRouter()
const vehiclesStore = useVehiclesStore()
const invoicesStore = useInvoicesStore()
const maintenancesStore = useMaintenancesStore()
const { dbPromise } = useDatabase()
const tab = ref('maintenance')

const vehicle = computed(() =>
  vehiclesStore.vehicles.find(v => v.id === route.params.id),
)

const selectedInvoice = ref<Invoice | null>(null)
const confirmDeleteInvoice = ref(false)
const confirmDeleteVehicle = ref(false)
const confirmDeleteMaintenance = ref<string | null>(null)

onMounted(async () => {
  await vehiclesStore.load()
  const id = route.params.id as string
  await invoicesStore.loadForVehicle(id)
  await maintenancesStore.loadForVehicle(id)
})

async function deleteInvoice(invoiceId: string) {
  const db = await dbPromise
  const doc = await (db as any).invoices.findOne({ selector: { id: invoiceId } }).exec()
  if (doc)
    await doc.remove()
  selectedInvoice.value = null
  confirmDeleteInvoice.value = false
}

async function deleteMaintenance(id: string) {
  const db = await dbPromise
  const doc = await (db as any).maintenances.findOne({ selector: { id } }).exec()
  if (doc)
    await doc.remove()
  confirmDeleteMaintenance.value = null
}

async function deleteVehicle() {
  const id = route.params.id as string
  const db = await dbPromise
  // Delete invoices and maintenances first
  const invoices = await (db as any).invoices.find({ selector: { vehicleId: id } }).exec()
  for (const inv of invoices) await inv.remove()
  const maintenances = await (db as any).maintenances.find({ selector: { vehicleId: id } }).exec()
  for (const m of maintenances) await m.remove()
  await vehiclesStore.remove(id)
  confirmDeleteVehicle.value = false
  router.push('/vehicles')
}
</script>

<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <q-btn flat icon="arrow_back" to="/vehicles" />
      <q-space />
      <q-btn flat color="negative" icon="delete" label="Löschen" @click="confirmDeleteVehicle = true" />
    </div>

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
              <q-item-section side>
                <q-btn flat round dense icon="delete" color="negative" @click="confirmDeleteMaintenance = m.id">
                  <q-tooltip>Eintrag löschen</q-tooltip>
                </q-btn>
              </q-item-section>
            </q-item>
          </q-list>
          <div v-if="maintenancesStore.maintenances.length === 0" class="text-grey q-pa-md text-center">
            Keine Wartungseinträge vorhanden.
          </div>
        </q-tab-panel>

        <q-tab-panel name="invoices">
          <q-list bordered separator>
            <q-item v-for="inv in invoicesStore.invoices" :key="inv.id" clickable @click="selectedInvoice = inv">
              <q-item-section avatar>
                <q-icon :name="inv.imageData ? 'image' : 'receipt'" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ inv.workshopName }}</q-item-label>
                <q-item-label caption>
                  {{ inv.date }} · {{ inv.totalAmount?.toFixed(2) }} €
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-icon name="chevron_right" />
              </q-item-section>
            </q-item>
          </q-list>
          <div v-if="invoicesStore.invoices.length === 0" class="text-grey q-pa-md text-center">
            Keine Rechnungen vorhanden.
          </div>
        </q-tab-panel>
      </q-tab-panels>
    </template>

    <!-- Invoice detail dialog -->
    <q-dialog :model-value="!!selectedInvoice" @update:model-value="v => { if (!v) selectedInvoice = null }">
      <q-card v-if="selectedInvoice" style="min-width: 340px; max-width: 90vw">
        <q-card-section>
          <div class="text-h6">
            {{ selectedInvoice.workshopName }}
          </div>
          <div class="text-subtitle2">
            {{ selectedInvoice.date }} · {{ selectedInvoice.totalAmount?.toFixed(2) }} €
          </div>
        </q-card-section>

        <q-card-section v-if="selectedInvoice.imageData">
          <q-img
            :src="`data:image/png;base64,${selectedInvoice.imageData}`"
            style="max-height: 400px"
            fit="contain"
          />
        </q-card-section>

        <q-card-section v-if="selectedInvoice.items?.length">
          <div class="text-subtitle1 q-mb-sm">
            Positionen
          </div>
          <q-list dense bordered separator>
            <q-item v-for="(item, i) in selectedInvoice.items" :key="i">
              <q-item-section>
                <q-item-label>{{ item.description }}</q-item-label>
                <q-item-label caption>
                  {{ item.category }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                {{ item.amount?.toFixed(2) }} €
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat color="negative" label="Löschen" @click="confirmDeleteInvoice = true" />
          <q-btn flat label="Schließen" @click="selectedInvoice = null" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Confirm delete invoice -->
    <q-dialog v-model="confirmDeleteInvoice">
      <q-card>
        <q-card-section>
          <div class="text-h6">
            Rechnung löschen?
          </div>
          <div>Diese Aktion kann nicht rückgängig gemacht werden.</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Abbrechen" @click="confirmDeleteInvoice = false" />
          <q-btn flat color="negative" label="Löschen" @click="deleteInvoice(selectedInvoice!.id)" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Confirm delete maintenance -->
    <q-dialog :model-value="!!confirmDeleteMaintenance" @update:model-value="v => { if (!v) confirmDeleteMaintenance = null }">
      <q-card>
        <q-card-section>
          <div class="text-h6">
            Wartungseintrag löschen?
          </div>
          <div>Diese Aktion kann nicht rückgängig gemacht werden.</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Abbrechen" @click="confirmDeleteMaintenance = null" />
          <q-btn flat color="negative" label="Löschen" @click="deleteMaintenance(confirmDeleteMaintenance!)" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Confirm delete vehicle -->
    <q-dialog v-model="confirmDeleteVehicle">
      <q-card>
        <q-card-section>
          <div class="text-h6">
            Fahrzeug löschen?
          </div>
          <div>Alle Rechnungen und Wartungseinträge werden ebenfalls gelöscht.</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Abbrechen" @click="confirmDeleteVehicle = false" />
          <q-btn flat color="negative" label="Löschen" @click="deleteVehicle" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>
