<script setup lang="ts">
import type { Invoice, InvoiceItem } from '../stores/invoices'
import type { Maintenance } from '../stores/maintenances'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MediaViewer from '../components/MediaViewer.vue'
import VehicleForm from '../components/VehicleForm.vue'
import { useDatabase } from '../composables/useDatabase'
import { useInvoicesStore } from '../stores/invoices'
import { useMaintenancesStore } from '../stores/maintenances'
import { useVehiclesStore } from '../stores/vehicles'

const route = useRoute()
const router = useRouter()
const vehiclesStore = useVehiclesStore()
const invoicesStore = useInvoicesStore()
const maintenancesStore = useMaintenancesStore()
const tab = ref('maintenance')

const vehicle = computed(() =>
  vehiclesStore.vehicles.find(v => v.id === route.params.id),
)

const selectedInvoice = ref<Invoice | null>(null)
const confirmDeleteInvoice = ref(false)
const confirmDeleteVehicle = ref(false)
const confirmDeleteMaintenance = ref<string | null>(null)
const confirmResetSchedule = ref(false)
const mediaViewerOpen = ref(false)
const mediaViewerOcr = ref('')
const { dbPromise } = useDatabase()

// Edit state
const editVehicle = ref(false)
const editInvoice = ref<Invoice | null>(null)
const editInvoiceForm = ref({
  workshopName: '',
  date: '',
  totalAmount: 0,
  currency: '€',
  mileageAtService: 0,
  items: [] as InvoiceItem[],
})
const editMaintenance = ref<Maintenance | null>(null)
const editMaintenanceForm = ref({
  type: '',
  description: '',
  doneAt: '',
  mileageAtService: 0,
  nextDueDate: '',
  nextDueMileage: 0,
  status: 'done' as Maintenance['status'],
})

onMounted(async () => {
  await vehiclesStore.load()
  const id = route.params.id as string
  await invoicesStore.loadForVehicle(id)
  await maintenancesStore.loadForVehicle(id)
})

async function deleteInvoice(invoiceId: string) {
  await invoicesStore.remove(invoiceId)
  selectedInvoice.value = null
  confirmDeleteInvoice.value = false
}

async function deleteMaintenance(id: string) {
  await maintenancesStore.remove(id)
  confirmDeleteMaintenance.value = null
}

async function deleteVehicle() {
  const id = route.params.id as string
  // Delete invoices and maintenances first
  for (const inv of invoicesStore.invoices)
    await invoicesStore.remove(inv.id)
  for (const m of maintenancesStore.maintenances)
    await maintenancesStore.remove(m.id)
  await vehiclesStore.remove(id)
  confirmDeleteVehicle.value = false
  router.push('/vehicles')
}

async function saveVehicleEdit(data: { make: string, model: string, year: number, mileage: number, licensePlate: string, vin: string }) {
  if (!vehicle.value)
    return
  await vehiclesStore.update(vehicle.value.id, data)
  editVehicle.value = false
}

function openEditInvoice(inv: Invoice) {
  editInvoice.value = inv
  editInvoiceForm.value = {
    workshopName: inv.workshopName || '',
    date: inv.date || '',
    totalAmount: inv.totalAmount || 0,
    currency: inv.currency || '€',
    mileageAtService: inv.mileageAtService || 0,
    items: inv.items ? inv.items.map(i => ({ ...i })) : [],
  }
}

async function saveInvoiceEdit() {
  if (!editInvoice.value)
    return
  await invoicesStore.update(editInvoice.value.id, { ...editInvoiceForm.value })
  editInvoice.value = null
  selectedInvoice.value = null
}

function addInvoiceItem() {
  editInvoiceForm.value.items.push({ description: '', category: '', amount: 0 })
}

function removeInvoiceItem(index: number) {
  editInvoiceForm.value.items.splice(index, 1)
}

function openEditMaintenance(m: Maintenance) {
  editMaintenance.value = m
  editMaintenanceForm.value = {
    type: m.type || '',
    description: m.description || '',
    doneAt: m.doneAt || '',
    mileageAtService: m.mileageAtService || 0,
    nextDueDate: m.nextDueDate || '',
    nextDueMileage: m.nextDueMileage || 0,
    status: m.status || 'done',
  }
}

async function saveMaintenanceEdit() {
  if (!editMaintenance.value)
    return
  await maintenancesStore.update(editMaintenance.value.id, { ...editMaintenanceForm.value })
  editMaintenance.value = null
}

async function openMediaViewer(inv: Invoice) {
  mediaViewerOcr.value = ''
  mediaViewerOpen.value = true
  if (inv.ocrCacheId) {
    try {
      const db = await dbPromise
      const doc = await (db as any).ocrcache.findOne({ selector: { id: inv.ocrCacheId } }).exec()
      if (doc)
        mediaViewerOcr.value = doc.markdown
    }
    catch {}
  }
}

async function resetSchedule() {
  if (!vehicle.value)
    return
  await vehiclesStore.updateCustomSchedule(vehicle.value.id, [])
  confirmResetSchedule.value = false
}
</script>

<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <q-btn flat icon="arrow_back" to="/vehicles" />
      <q-space />
      <q-btn flat color="primary" icon="edit" label="Bearbeiten" @click="editVehicle = true" />
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
          <q-banner v-if="!vehicle.customSchedule?.length" class="bg-warning text-white q-mb-md schedule-hint" rounded>
            <template #avatar>
              <q-icon name="info" />
            </template>
            Der Wartungsplan basiert auf allgemeinen Intervallen.
            Fotografiere dein Service-Heft und schick es im Chat — dann werden die genauen Hersteller-Intervalle für dein Fahrzeug hinterlegt.
          </q-banner>
          <div v-if="vehicle.customSchedule?.length" class="q-mb-md">
            <div class="text-subtitle2 q-mb-sm">
              Fahrzeugspezifischer Wartungsplan
            </div>
            <q-list bordered separator dense>
              <q-item v-for="(item, i) in vehicle.customSchedule" :key="i">
                <q-item-section avatar>
                  <q-icon name="event_repeat" color="primary" size="sm" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ item.label }}</q-item-label>
                  <q-item-label caption>
                    {{ item.intervalKm > 0 ? `${item.intervalKm.toLocaleString()} km` : '' }}{{ item.intervalKm > 0 && item.intervalMonths > 0 ? ' / ' : '' }}{{ item.intervalMonths > 0 ? `${item.intervalMonths} Monate` : '' }}
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
            <q-btn
              flat dense size="sm" color="negative" icon="delete" label="Zurücksetzen"
              class="q-mt-xs" @click="confirmResetSchedule = true"
            />
          </div>
          <q-list bordered separator>
            <q-item v-for="m in maintenancesStore.maintenances" :key="m.id">
              <q-item-section>
                <q-item-label>{{ m.description || m.type }}</q-item-label>
                <q-item-label caption>
                  {{ m.doneAt }} · {{ m.mileageAtService?.toLocaleString('de-DE') }} km
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <div class="row no-wrap">
                  <q-btn flat round dense icon="edit" color="primary" @click="openEditMaintenance(m)">
                    <q-tooltip>Eintrag bearbeiten</q-tooltip>
                  </q-btn>
                  <q-btn flat round dense icon="delete" color="negative" @click="confirmDeleteMaintenance = m.id">
                    <q-tooltip>Eintrag löschen</q-tooltip>
                  </q-btn>
                </div>
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
                  {{ inv.date }} · {{ inv.totalAmount?.toFixed(2) }} {{ inv.currency || '€' }}
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
            {{ selectedInvoice.date }} · {{ selectedInvoice.totalAmount?.toFixed(2) }} {{ selectedInvoice.currency || '€' }}
          </div>
        </q-card-section>

        <q-card-section v-if="selectedInvoice.imageData">
          <q-img
            :src="selectedInvoice.imageData.startsWith('/9j/') ? `data:image/jpeg;base64,${selectedInvoice.imageData}` : `data:image/webp;base64,${selectedInvoice.imageData}`"
            style="max-height: 400px; cursor: pointer"
            fit="contain"
            @click="openMediaViewer(selectedInvoice!)"
          />
          <div class="text-caption text-grey text-center q-mt-xs">
            Klick zum Vergrößern
          </div>
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
                {{ item.amount?.toFixed(2) }} {{ selectedInvoice.currency || '€' }}
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat color="primary" label="Bearbeiten" @click="openEditInvoice(selectedInvoice!)" />
          <q-btn flat color="negative" label="Löschen" @click="confirmDeleteInvoice = true" />
          <q-btn flat label="Schließen" @click="selectedInvoice = null" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Edit vehicle dialog -->
    <q-dialog v-model="editVehicle">
      <q-card style="min-width: 340px; max-width: 90vw">
        <q-card-section>
          <div class="text-h6">
            Fahrzeug bearbeiten
          </div>
        </q-card-section>
        <q-card-section>
          <VehicleForm v-if="vehicle" :initial-data="vehicle" @save="saveVehicleEdit" />
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Edit invoice dialog -->
    <q-dialog :model-value="!!editInvoice" @update:model-value="v => { if (!v) editInvoice = null }">
      <q-card style="min-width: 340px; max-width: 90vw">
        <q-card-section>
          <div class="text-h6">
            Rechnung bearbeiten
          </div>
        </q-card-section>
        <q-card-section>
          <q-form class="q-gutter-md" @submit="saveInvoiceEdit">
            <q-input v-model="editInvoiceForm.workshopName" label="Werkstatt" outlined />
            <q-input v-model="editInvoiceForm.date" label="Datum" outlined type="date" />
            <q-input v-model.number="editInvoiceForm.totalAmount" label="Gesamtbetrag" outlined type="number" step="0.01" />
            <q-input v-model="editInvoiceForm.currency" label="Währung" outlined />
            <q-input v-model.number="editInvoiceForm.mileageAtService" label="Kilometerstand" outlined type="number" />

            <div class="text-subtitle1 q-mt-md">
              Positionen
            </div>
            <div v-for="(item, i) in editInvoiceForm.items" :key="i" class="row q-gutter-sm items-center">
              <q-input v-model="item.description" label="Beschreibung" outlined dense class="col" />
              <q-input v-model="item.category" label="Kategorie" outlined dense class="col-3" />
              <q-input v-model.number="item.amount" label="Betrag" outlined dense type="number" step="0.01" class="col-2" />
              <q-btn flat round dense icon="remove_circle" color="negative" @click="removeInvoiceItem(i)" />
            </div>
            <q-btn flat icon="add" label="Position hinzufügen" @click="addInvoiceItem" />

            <div class="row justify-end q-gutter-sm q-mt-md">
              <q-btn flat label="Abbrechen" @click="editInvoice = null" />
              <q-btn type="submit" label="Speichern" color="primary" />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Edit maintenance dialog -->
    <q-dialog :model-value="!!editMaintenance" @update:model-value="v => { if (!v) editMaintenance = null }">
      <q-card style="min-width: 340px; max-width: 90vw">
        <q-card-section>
          <div class="text-h6">
            Wartungseintrag bearbeiten
          </div>
        </q-card-section>
        <q-card-section>
          <q-form class="q-gutter-md" @submit="saveMaintenanceEdit">
            <q-input v-model="editMaintenanceForm.type" label="Typ" outlined />
            <q-input v-model="editMaintenanceForm.description" label="Beschreibung" outlined />
            <q-input v-model="editMaintenanceForm.doneAt" label="Erledigt am" outlined type="date" />
            <q-input v-model.number="editMaintenanceForm.mileageAtService" label="Kilometerstand" outlined type="number" />
            <q-input v-model="editMaintenanceForm.nextDueDate" label="Nächster Termin" outlined type="date" />
            <q-input v-model.number="editMaintenanceForm.nextDueMileage" label="Nächster Kilometerstand" outlined type="number" />
            <q-select
              v-model="editMaintenanceForm.status"
              label="Status"
              outlined
              :options="[
                { label: 'Erledigt', value: 'done' },
                { label: 'Fällig', value: 'due' },
                { label: 'Überfällig', value: 'overdue' },
              ]"
              emit-value
              map-options
            />
            <div class="row justify-end q-gutter-sm q-mt-md">
              <q-btn flat label="Abbrechen" @click="editMaintenance = null" />
              <q-btn type="submit" label="Speichern" color="primary" />
            </div>
          </q-form>
        </q-card-section>
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

    <!-- Confirm reset schedule -->
    <q-dialog v-model="confirmResetSchedule">
      <q-card>
        <q-card-section>
          <div class="text-h6">
            Wartungsplan zurücksetzen?
          </div>
          <div>Der fahrzeugspezifische Wartungsplan wird gelöscht und die Standard-Intervalle werden verwendet.</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Abbrechen" @click="confirmResetSchedule = false" />
          <q-btn flat color="negative" label="Zurücksetzen" @click="resetSchedule" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Fullscreen media viewer -->
    <MediaViewer
      v-if="selectedInvoice"
      v-model="mediaViewerOpen"
      :image-base64="selectedInvoice.imageData"
      :ocr-markdown="mediaViewerOcr"
    />

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
