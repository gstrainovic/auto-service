<script setup lang="ts">
import type { Invoice, InvoiceItem } from '../stores/invoices'
import type { Maintenance } from '../stores/maintenances'
import type { InvoiceFormData, MaintenanceFormData } from '../types/forms'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import InvoiceFormDialog from '../components/InvoiceFormDialog.vue'
import MaintenanceFormDialog from '../components/MaintenanceFormDialog.vue'
import MediaViewer from '../components/MediaViewer.vue'
import VehicleForm from '../components/VehicleForm.vue'
import { db } from '../lib/instantdb'
import { DEFAULT_CURRENCY, formatCurrency, formatNumber } from '../lib/locale'
import { buildDossier, dossierFilename } from '../services/pdf-report'
import { categoryLabel, costsByYear, invoicesToCsv } from '../services/report'
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

// New form dialogs
const showAddInvoiceDialog = ref(false)
const showAddMaintenanceDialog = ref(false)

// Edit state
const editVehicle = ref(false)
const editInvoice = ref<Invoice | null>(null)
const editInvoiceForm = ref({
  workshopName: '',
  date: '',
  totalAmount: 0,
  currency: DEFAULT_CURRENCY,
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

const statusOptions = [
  { label: 'Erledigt', value: 'done' },
  { label: 'Fällig', value: 'due' },
  { label: 'Überfällig', value: 'overdue' },
]

onMounted(async () => {
  await vehiclesStore.load()
  const id = route.params.id as string
  await invoicesStore.loadForVehicle(id)
  await maintenancesStore.loadForVehicle(id)
})

async function deleteInvoice(invoiceId: string): Promise<void> {
  await invoicesStore.remove(invoiceId)
  selectedInvoice.value = null
  confirmDeleteInvoice.value = false
}

async function deleteMaintenance(id: string): Promise<void> {
  await maintenancesStore.remove(id)
  confirmDeleteMaintenance.value = null
}

async function deleteVehicle(): Promise<void> {
  const id = route.params.id as string
  for (const inv of invoicesStore.invoices)
    await invoicesStore.remove(inv.id)
  for (const m of maintenancesStore.maintenances)
    await maintenancesStore.remove(m.id)
  await vehiclesStore.remove(id)
  confirmDeleteVehicle.value = false
  router.push('/vehicles')
}

async function saveVehicleEdit(data: { make: string, model: string, year: number, mileage: number, licensePlate: string, vin: string }): Promise<void> {
  if (!vehicle.value)
    return
  await vehiclesStore.update(vehicle.value.id, data)
  editVehicle.value = false
}

function openEditInvoice(inv: Invoice): void {
  editInvoice.value = inv
  editInvoiceForm.value = {
    workshopName: inv.workshopName || '',
    date: inv.date || '',
    totalAmount: inv.totalAmount || 0,
    currency: inv.currency || DEFAULT_CURRENCY,
    mileageAtService: inv.mileageAtService || 0,
    items: inv.items ? inv.items.map(i => ({ ...i })) : [],
  }
}

async function saveInvoiceEdit(): Promise<void> {
  if (!editInvoice.value)
    return
  await invoicesStore.update(editInvoice.value.id, { ...editInvoiceForm.value })
  editInvoice.value = null
  selectedInvoice.value = null
}

function addInvoiceItem(): void {
  editInvoiceForm.value.items.push({ description: '', category: '', amount: 0 })
}

function removeInvoiceItem(index: number): void {
  editInvoiceForm.value.items.splice(index, 1)
}

function openEditMaintenance(m: Maintenance): void {
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

async function saveMaintenanceEdit(): Promise<void> {
  if (!editMaintenance.value)
    return
  await maintenancesStore.update(editMaintenance.value.id, { ...editMaintenanceForm.value })
  editMaintenance.value = null
}

async function openMediaViewer(inv: Invoice): Promise<void> {
  mediaViewerOcr.value = ''
  mediaViewerOpen.value = true
  if (inv.ocrCacheId) {
    try {
      const result = await db.queryOnce({ ocrcache: {} })
      const entries = result.data.ocrcache || []
      const doc = entries.find((e: any) => e.hash === inv.ocrCacheId)
      if (doc)
        mediaViewerOcr.value = doc.markdown
    }
    catch {}
  }
}

async function resetSchedule(): Promise<void> {
  if (!vehicle.value)
    return
  await vehiclesStore.updateCustomSchedule(vehicle.value.id, [])
  confirmResetSchedule.value = false
}

function getImageSrc(imageData: string): string {
  if (imageData.startsWith('/9j/'))
    return `data:image/jpeg;base64,${imageData}`
  return `data:image/webp;base64,${imageData}`
}

async function handleAddInvoice(data: InvoiceFormData): Promise<void> {
  if (!vehicle.value)
    return

  await invoicesStore.add({
    vehicleId: vehicle.value.id,
    workshopName: data.workshop,
    date: data.date,
    totalAmount: data.amount,
    currency: data.currency || DEFAULT_CURRENCY,
    mileageAtService: vehicle.value.mileage,
    items: data.category
      ? [{
          description: data.description || '',
          category: data.category,
          amount: data.amount || 0,
        }]
      : [],
    imageData: data.images?.[0],
  })

  showAddInvoiceDialog.value = false
}

// Kostenübersicht und Exporte (CSV für Excel und Treuhänder, PDF-Dossier für Verkauf und Übergabe)
const yearCosts = computed(() => costsByYear(invoicesStore.invoices))
const costCategories = computed(() => [...new Set(yearCosts.value.flatMap(r => Object.keys(r.byCategory)))])
const grandTotals = computed(() => {
  const totals: Record<string, number> = {}
  for (const r of yearCosts.value)
    totals[r.currency] = Math.round(((totals[r.currency] ?? 0) + r.total) * 100) / 100
  return Object.entries(totals).map(([currency, total]) => formatCurrency(total, currency)).join(' + ')
})

function saveFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportCsv(): void {
  if (!vehicle.value)
    return
  const csv = invoicesToCsv(invoicesStore.invoices, vehicle.value)
  const name = dossierFilename(vehicle.value).replace(/\.pdf$/, '.csv')
  saveFile(new Blob([csv], { type: 'text/csv;charset=utf-8' }), name)
}

function exportPdf(): void {
  if (!vehicle.value)
    return
  const doc = buildDossier({ vehicle: vehicle.value, invoices: invoicesStore.invoices, maintenances: maintenancesStore.maintenances })
  saveFile(doc.output('blob'), dossierFilename(vehicle.value))
}

async function handleAddMaintenance(data: MaintenanceFormData): Promise<void> {
  if (!vehicle.value)
    return

  const status = data.status === 'planned' ? 'due' : 'done'

  await maintenancesStore.add({
    vehicleId: vehicle.value.id,
    type: data.category,
    description: data.description,
    doneAt: data.date,
    mileageAtService: data.mileage || vehicle.value.mileage,
    status,
  })

  showAddMaintenanceDialog.value = false
}
</script>

<template>
  <main class="page-container">
    <div class="header-row">
      <Button icon="pi pi-arrow-left" text to="/vehicles" as="router-link" />
      <div class="spacer" />
      <Button icon="pi pi-pencil" label="Bearbeiten" text severity="primary" @click="editVehicle = true" />
      <Button icon="pi pi-trash" label="Löschen" text severity="danger" @click="confirmDeleteVehicle = true" />
    </div>

    <template v-if="vehicle">
      <h2 class="vehicle-title">
        {{ vehicle.make }} {{ vehicle.model }}
      </h2>
      <div class="vehicle-subtitle">
        {{ vehicle.year }} · {{ vehicle.licensePlate }}
      </div>
      <div class="vehicle-mileage">
        <i class="pi pi-gauge" /> {{ formatNumber(vehicle.mileage) }} km
      </div>

      <Tabs v-model:value="tab">
        <TabList>
          <Tab value="maintenance">
            Wartung
          </Tab>
          <Tab value="invoices">
            Rechnungen
          </Tab>
          <Tab value="costs">
            Kosten
          </Tab>
        </TabList>

        <TabPanels>
          <TabPanel value="maintenance">
            <div class="tab-header">
              <Message v-if="!vehicle.customSchedule?.length" severity="warn" class="schedule-hint">
                <template #icon>
                  <i class="pi pi-info-circle" />
                </template>
                Der Wartungsplan basiert auf allgemeinen Intervallen.
                Fotografiere dein Service-Heft und schick es im Chat — dann werden die genauen Hersteller-Intervalle für dein Fahrzeug hinterlegt.
              </Message>
              <Button
                icon="pi pi-plus"
                label="Wartung hinzufügen"
                severity="primary"
                @click="showAddMaintenanceDialog = true"
              />
            </div>

            <div v-if="vehicle.customSchedule?.length" class="custom-schedule-section">
              <div class="section-title">
                Fahrzeugspezifischer Wartungsplan
              </div>
              <div class="schedule-list">
                <div v-for="(item, i) in vehicle.customSchedule" :key="i" class="schedule-item">
                  <i class="pi pi-replay schedule-icon" />
                  <div class="schedule-content">
                    <div class="schedule-label">
                      {{ item.label }}
                    </div>
                    <div class="schedule-interval">
                      {{ item.intervalKm > 0 ? `${item.intervalKm.toLocaleString()} km` : '' }}{{ item.intervalKm > 0 && item.intervalMonths > 0 ? ' / ' : '' }}{{ item.intervalMonths > 0 ? `${item.intervalMonths} Monate` : '' }}
                    </div>
                  </div>
                </div>
              </div>
              <Button
                icon="pi pi-trash"
                label="Zurücksetzen"
                text
                size="small"
                severity="danger"
                @click="confirmResetSchedule = true"
              />
            </div>

            <div class="maintenance-list">
              <div v-for="m in maintenancesStore.maintenances" :key="m.id" class="maintenance-item">
                <div class="maintenance-content">
                  <div class="maintenance-label">
                    {{ m.description || m.type }}
                  </div>
                  <div class="maintenance-caption">
                    {{ m.doneAt }} · {{ formatNumber(m.mileageAtService) }} km
                  </div>
                </div>
                <div class="maintenance-actions">
                  <Button
                    v-tooltip.top="'Eintrag bearbeiten'"
                    aria-label="Bearbeiten"
                    icon="pi pi-pencil"
                    text
                    rounded
                    severity="primary"
                    @click="openEditMaintenance(m)"
                  />
                  <Button
                    v-tooltip.top="'Eintrag löschen'"
                    aria-label="Löschen"
                    icon="pi pi-trash"
                    text
                    rounded
                    severity="danger"
                    @click="confirmDeleteMaintenance = m.id"
                  />
                </div>
              </div>
            </div>
            <div v-if="maintenancesStore.maintenances.length === 0" class="empty-state">
              <i class="pi pi-wrench empty-icon" />
              <p>Keine Wartungseinträge. Scanne eine Rechnung im Chat!</p>
            </div>
          </TabPanel>

          <TabPanel value="invoices">
            <div class="tab-header">
              <Button
                icon="pi pi-plus"
                label="Rechnung hinzufügen"
                severity="primary"
                @click="showAddInvoiceDialog = true"
              />
            </div>
            <div class="invoices-list">
              <div
                v-for="inv in invoicesStore.invoices"
                :key="inv.id"
                class="invoice-item"
                @click="selectedInvoice = inv"
              >
                <i :class="inv.imageData ? 'pi pi-image' : 'pi pi-receipt'" class="invoice-icon" />
                <div class="invoice-content">
                  <div class="invoice-label">
                    {{ inv.workshopName }}
                  </div>
                  <div class="invoice-caption">
                    {{ inv.date }} · {{ formatCurrency(inv.totalAmount, inv.currency || DEFAULT_CURRENCY) }}
                  </div>
                </div>
                <i class="pi pi-chevron-right" />
              </div>
            </div>
            <div v-if="invoicesStore.invoices.length === 0" class="empty-state">
              <i class="pi pi-file empty-icon" />
              <p>Keine Rechnungen. Scanne deine erste Werkstattrechnung!</p>
            </div>
          </TabPanel>

          <TabPanel value="costs">
            <div class="tab-header costs-actions">
              <Button icon="pi pi-file-excel" label="CSV für Excel" severity="secondary" outlined :disabled="!invoicesStore.invoices.length" @click="exportCsv" />
              <Button icon="pi pi-file-pdf" label="PDF-Dossier" severity="primary" @click="exportPdf" />
            </div>
            <div v-if="yearCosts.length" class="costs-table-wrap">
              <table class="costs-table" aria-label="Kosten pro Jahr">
                <thead>
                  <tr>
                    <th>Jahr</th>
                    <th v-for="c in costCategories" :key="c" class="num">
                      {{ categoryLabel(c) }}
                    </th>
                    <th class="num">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in yearCosts" :key="`${r.year}-${r.currency}`">
                    <td>{{ r.year }} <span class="costs-currency">{{ r.currency }}</span></td>
                    <td v-for="c in costCategories" :key="c" class="num">
                      {{ r.byCategory[c] === undefined ? '' : formatNumber(r.byCategory[c], 2) }}
                    </td>
                    <td class="num costs-total">
                      {{ formatCurrency(r.total, r.currency) }}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div class="costs-grand">
                Gesamt {{ grandTotals }}
              </div>
              <p class="costs-hint">
                Summen pro Währung getrennt, Positionen nach Kategorie. CSV öffnet sich in Excel mit Schweizer Format; das PDF enthält Stammdaten, Wartungshistorie, Kosten und Rechnungen.
              </p>
            </div>
            <div v-else class="empty-state">
              <i class="pi pi-chart-bar empty-icon" />
              <p>Noch keine Belege erfasst, darum keine Kosten. Das PDF-Dossier geht trotzdem, mit Stammdaten und Wartungen.</p>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </template>

    <!-- Invoice detail dialog -->
    <Dialog
      :visible="!!selectedInvoice"
      modal
      header=""
      :style="{ minWidth: '340px', maxWidth: '90vw' }"
      @update:visible="v => { if (!v) selectedInvoice = null }"
    >
      <template v-if="selectedInvoice">
        <div class="dialog-header">
          {{ selectedInvoice.workshopName }}
        </div>
        <div class="dialog-subheader">
          {{ selectedInvoice.date }} · {{ formatCurrency(selectedInvoice.totalAmount, selectedInvoice.currency || DEFAULT_CURRENCY) }}
        </div>

        <div v-if="selectedInvoice.imageData" class="invoice-image-section">
          <img
            :src="getImageSrc(selectedInvoice.imageData)"
            class="invoice-image"
            @click="openMediaViewer(selectedInvoice!)"
          >
          <div class="image-hint">
            Klick zum Vergrößern
          </div>
        </div>

        <div v-if="selectedInvoice.items?.length" class="items-section">
          <div class="items-title">
            Positionen
          </div>
          <div class="items-list">
            <div v-for="(item, i) in selectedInvoice.items" :key="i" class="position-item">
              <div class="position-content">
                <div class="position-label">
                  {{ item.description }}
                </div>
                <div class="position-caption">
                  {{ item.category }}
                </div>
              </div>
              <div class="position-amount">
                {{ formatCurrency(item.amount, selectedInvoice.currency || DEFAULT_CURRENCY) }}
              </div>
            </div>
          </div>
        </div>

        <div class="dialog-actions">
          <Button label="Bearbeiten" text severity="primary" @click="openEditInvoice(selectedInvoice!)" />
          <Button label="Löschen" text severity="danger" @click="confirmDeleteInvoice = true" />
          <Button label="Schließen" text @click="selectedInvoice = null" />
        </div>
      </template>
    </Dialog>

    <!-- Edit vehicle dialog -->
    <Dialog v-model:visible="editVehicle" modal header="Fahrzeug bearbeiten" :style="{ minWidth: '340px', maxWidth: '90vw' }">
      <VehicleForm v-if="vehicle" :initial-data="vehicle" @save="saveVehicleEdit" />
    </Dialog>

    <!-- Edit invoice dialog -->
    <Dialog
      :visible="!!editInvoice"
      modal
      header="Rechnung bearbeiten"
      :style="{ minWidth: '340px', maxWidth: '90vw' }"
      @update:visible="v => { if (!v) editInvoice = null }"
    >
      <form class="edit-form" @submit.prevent="saveInvoiceEdit">
        <div class="form-field">
          <label for="invoice-workshop">Werkstatt</label>
          <InputText id="invoice-workshop" v-model="editInvoiceForm.workshopName" class="w-full" />
        </div>
        <div class="form-field">
          <label for="invoice-date">Datum</label>
          <InputText id="invoice-date" v-model="editInvoiceForm.date" type="date" class="w-full" />
        </div>
        <div class="form-field">
          <label for="invoice-total">Gesamtbetrag</label>
          <InputNumber id="invoice-total" v-model="editInvoiceForm.totalAmount" mode="decimal" :min-fraction-digits="2" class="w-full" input-id="invoice-total-input" />
        </div>
        <div class="form-field">
          <label for="invoice-currency">Währung</label>
          <InputText id="invoice-currency" v-model="editInvoiceForm.currency" class="w-full" />
        </div>
        <div class="form-field">
          <label for="invoice-mileage">Kilometerstand</label>
          <InputNumber id="invoice-mileage" v-model="editInvoiceForm.mileageAtService" class="w-full" input-id="invoice-mileage-input" />
        </div>

        <div class="items-section">
          <div class="items-title">
            Positionen
          </div>
          <div v-for="(item, i) in editInvoiceForm.items" :key="i" class="item-row">
            <InputText v-model="item.description" placeholder="Beschreibung" class="flex-grow" />
            <InputText v-model="item.category" placeholder="Kategorie" class="category-input" />
            <InputNumber v-model="item.amount" mode="decimal" :min-fraction-digits="2" placeholder="Betrag" class="amount-input" />
            <Button icon="pi pi-minus-circle" text rounded severity="danger" @click="removeInvoiceItem(i)" />
          </div>
          <Button icon="pi pi-plus" label="Position hinzufügen" text @click="addInvoiceItem" />
        </div>

        <div class="dialog-actions">
          <Button label="Abbrechen" text @click="editInvoice = null" />
          <Button type="submit" label="Speichern" severity="primary" />
        </div>
      </form>
    </Dialog>

    <!-- Edit maintenance dialog -->
    <Dialog
      :visible="!!editMaintenance"
      modal
      header="Wartungseintrag bearbeiten"
      :style="{ minWidth: '340px', maxWidth: '90vw' }"
      @update:visible="v => { if (!v) editMaintenance = null }"
    >
      <form class="edit-form" @submit.prevent="saveMaintenanceEdit">
        <div class="form-field">
          <label for="maintenance-type">Typ</label>
          <InputText id="maintenance-type" v-model="editMaintenanceForm.type" class="w-full" />
        </div>
        <div class="form-field">
          <label for="maintenance-description">Beschreibung</label>
          <InputText id="maintenance-description" v-model="editMaintenanceForm.description" class="w-full" />
        </div>
        <div class="form-field">
          <label for="maintenance-done-at">Erledigt am</label>
          <InputText id="maintenance-done-at" v-model="editMaintenanceForm.doneAt" type="date" class="w-full" />
        </div>
        <div class="form-field">
          <label for="maintenance-mileage">Kilometerstand</label>
          <InputNumber id="maintenance-mileage" v-model="editMaintenanceForm.mileageAtService" class="w-full" input-id="maintenance-mileage-input" />
        </div>
        <div class="form-field">
          <label for="maintenance-next-date">Nächster Termin</label>
          <InputText id="maintenance-next-date" v-model="editMaintenanceForm.nextDueDate" type="date" class="w-full" />
        </div>
        <div class="form-field">
          <label for="maintenance-next-mileage">Nächster Kilometerstand</label>
          <InputNumber id="maintenance-next-mileage" v-model="editMaintenanceForm.nextDueMileage" class="w-full" input-id="maintenance-next-mileage-input" />
        </div>
        <div class="form-field">
          <label for="maintenance-status">Status</label>
          <Select
            id="maintenance-status"
            v-model="editMaintenanceForm.status"
            :options="statusOptions"
            option-label="label"
            option-value="value"
            class="w-full"
          />
        </div>
        <div class="dialog-actions">
          <Button label="Abbrechen" text @click="editMaintenance = null" />
          <Button type="submit" label="Speichern" severity="primary" />
        </div>
      </form>
    </Dialog>

    <!-- Confirm delete invoice -->
    <Dialog v-model:visible="confirmDeleteInvoice" modal header="Rechnung löschen?">
      <p>Diese Aktion kann nicht rückgängig gemacht werden.</p>
      <template #footer>
        <Button label="Abbrechen" text @click="confirmDeleteInvoice = false" />
        <Button label="Löschen" severity="danger" @click="deleteInvoice(selectedInvoice!.id)" />
      </template>
    </Dialog>

    <!-- Confirm delete maintenance -->
    <Dialog
      :visible="!!confirmDeleteMaintenance"
      modal
      header="Wartungseintrag löschen?"
      @update:visible="v => { if (!v) confirmDeleteMaintenance = null }"
    >
      <p>Diese Aktion kann nicht rückgängig gemacht werden.</p>
      <template #footer>
        <Button label="Abbrechen" text @click="confirmDeleteMaintenance = null" />
        <Button label="Löschen" severity="danger" @click="deleteMaintenance(confirmDeleteMaintenance!)" />
      </template>
    </Dialog>

    <!-- Confirm reset schedule -->
    <Dialog v-model:visible="confirmResetSchedule" modal header="Wartungsplan zurücksetzen?">
      <p>Der fahrzeugspezifische Wartungsplan wird gelöscht und die Standard-Intervalle werden verwendet.</p>
      <template #footer>
        <Button label="Abbrechen" text @click="confirmResetSchedule = false" />
        <Button label="Zurücksetzen" severity="danger" @click="resetSchedule" />
      </template>
    </Dialog>

    <!-- Fullscreen media viewer -->
    <MediaViewer
      v-if="selectedInvoice"
      v-model="mediaViewerOpen"
      :image-base64="selectedInvoice.imageData"
      :ocr-markdown="mediaViewerOcr"
    />

    <!-- Confirm delete vehicle -->
    <Dialog v-model:visible="confirmDeleteVehicle" modal header="Fahrzeug löschen?">
      <p>Alle Rechnungen und Wartungseinträge werden ebenfalls gelöscht.</p>
      <template #footer>
        <Button label="Abbrechen" text @click="confirmDeleteVehicle = false" />
        <Button label="Löschen" severity="danger" @click="deleteVehicle" />
      </template>
    </Dialog>

    <!-- Add invoice dialog -->
    <InvoiceFormDialog
      v-model:visible="showAddInvoiceDialog"
      title="Neue Rechnung"
      @submit="handleAddInvoice"
    />

    <!-- Add maintenance dialog -->
    <MaintenanceFormDialog
      v-model:visible="showAddMaintenanceDialog"
      title="Neue Wartung"
      @submit="handleAddMaintenance"
    />
  </main>
</template>

<style scoped>
.page-container {
  padding: 1rem;
  max-width: 800px;
  margin: 0 auto;
}

.header-row {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
}

.spacer {
  flex: 1;
}

.vehicle-title {
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin: 0 0 0.25rem;
}

.vehicle-subtitle {
  font-size: 1rem;
  color: var(--text-color-secondary);
}

.vehicle-mileage {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.custom-schedule-section {
  margin-bottom: 1rem;
}

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.schedule-list {
  border: 1px solid var(--surface-border);
  border-radius: var(--border-radius);
}

.schedule-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-bottom: 1px solid var(--surface-border);
}

.schedule-item:last-child {
  border-bottom: none;
}

.schedule-icon {
  color: var(--primary-color);
}

.schedule-content {
  flex: 1;
}

.schedule-label {
  font-weight: 500;
}

.schedule-interval {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.maintenance-list,
.invoices-list {
  border: 1px solid var(--surface-border);
  border-radius: var(--border-radius);
}

.maintenance-item,
.invoice-item {
  display: flex;
  align-items: center;
  padding: 0.75rem;
  border-bottom: 1px solid var(--surface-border);
}

.maintenance-item:last-child,
.invoice-item:last-child {
  border-bottom: none;
}

.invoice-item {
  cursor: pointer;
}

.invoice-item:hover {
  background: var(--surface-hover);
}

.maintenance-content,
.invoice-content {
  flex: 1;
}

.maintenance-label,
.invoice-label {
  font-weight: 500;
}

.maintenance-caption,
.invoice-caption {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.maintenance-actions {
  display: flex;
  gap: 0.25rem;
}

.invoice-icon {
  margin-right: 0.75rem;
  font-size: 1.25rem;
  color: var(--text-color-secondary);
}

.empty-state {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--text-color-secondary);
}

.empty-icon {
  font-size: 3rem;
  color: var(--p-primary-color);
  opacity: 0.5;
  margin-bottom: 0.5rem;
}

.dialog-header {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.dialog-subheader {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  margin-bottom: 1rem;
}

.invoice-image-section {
  margin-bottom: 1rem;
}

.invoice-image {
  max-height: 400px;
  width: 100%;
  object-fit: contain;
  cursor: pointer;
  border-radius: var(--border-radius);
}

.image-hint {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  text-align: center;
  margin-top: 0.25rem;
}

.items-section {
  margin-top: 1rem;
}

.items-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.items-list {
  border: 1px solid var(--surface-border);
  border-radius: var(--border-radius);
}

.position-item {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--surface-border);
}

.position-item:last-child {
  border-bottom: none;
}

.position-content {
  flex: 1;
}

.position-label {
  font-weight: 500;
}

.position-caption {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.position-amount {
  font-weight: 500;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-field label {
  font-size: 0.875rem;
  font-weight: 500;
}

.w-full {
  width: 100%;
}

.item-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

.flex-grow {
  flex: 1;
}

.category-input {
  width: 8rem;
}

.amount-input {
  width: 6rem;
}

.tab-header {
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.costs-actions {
  flex-direction: row;
  flex-wrap: wrap;
}

.costs-table-wrap {
  overflow-x: auto;
}

.costs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.costs-table th,
.costs-table td {
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--p-surface-border);
  text-align: left;
  white-space: nowrap;
}

.costs-table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.costs-table .costs-total {
  font-weight: 600;
}

.costs-currency {
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
  margin-left: 0.25rem;
}

.costs-grand {
  margin-top: 0.75rem;
  font-weight: 600;
  text-align: right;
}

.costs-hint {
  margin: 0.75rem 0 0;
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
}
</style>
