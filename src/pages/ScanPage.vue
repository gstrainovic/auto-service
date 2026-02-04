<script setup lang="ts">
import type { ParsedInvoice, ParsedServiceBook, ParsedVehicleDocument } from '../services/ai'
import Button from 'primevue/button'
import Card from 'primevue/card'
import ProgressSpinner from 'primevue/progressspinner'
import Select from 'primevue/select'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import Tabs from 'primevue/tabs'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import InvoiceResult from '../components/InvoiceResult.vue'
import InvoiceScanner from '../components/InvoiceScanner.vue'
import { autoRotateForDocument } from '../composables/useImageResize'
import { hashImage, MAINTENANCE_CATEGORIES, parseInvoice, parseServiceBook, parseVehicleDocument } from '../services/ai'
import { useInvoicesStore } from '../stores/invoices'
import { useMaintenancesStore } from '../stores/maintenances'
import { useSettingsStore } from '../stores/settings'
import { useVehiclesStore } from '../stores/vehicles'

const vehiclesStore = useVehiclesStore()
const invoicesStore = useInvoicesStore()
const maintenancesStore = useMaintenancesStore()
const settingsStore = useSettingsStore()
const router = useRouter()

const scanTab = ref('rechnung')
const selectedVehicleId = ref('')
const imageBase64 = ref('')
const loading = ref(false)
const error = ref('')

const parsedInvoice = ref<ParsedInvoice | null>(null)
const parsedVehicleDoc = ref<ParsedVehicleDocument | null>(null)
const parsedServiceBook = ref<ParsedServiceBook | null>(null)

const vehicleOptions = computed(() =>
  vehiclesStore.vehicles.map(v => ({
    label: `${v.make} ${v.model} (${v.licensePlate})`,
    value: v.id,
  })),
)

onMounted(() => vehiclesStore.load())

function resetResults(): void {
  parsedInvoice.value = null
  parsedVehicleDoc.value = null
  parsedServiceBook.value = null
  error.value = ''
}

async function onCaptured(base64: string): Promise<void> {
  imageBase64.value = base64
  loading.value = true
  resetResults()

  try {
    if (scanTab.value === 'rechnung') {
      parsedInvoice.value = await parseInvoice(
        base64,
        settingsStore.aiProvider,
        settingsStore.aiApiKey,
        settingsStore.aiModel || undefined,
      )
    }
    else if (scanTab.value === 'fahrzeug') {
      parsedVehicleDoc.value = await parseVehicleDocument(
        base64,
        settingsStore.aiProvider,
        settingsStore.aiApiKey,
        settingsStore.aiModel || undefined,
      )
    }
    else if (scanTab.value === 'serviceheft') {
      parsedServiceBook.value = await parseServiceBook(
        base64,
        settingsStore.aiProvider,
        settingsStore.aiApiKey,
        settingsStore.aiModel || undefined,
      )
    }
  }
  catch (e: any) {
    error.value = `Fehler: ${e.message}. Prüfe deinen API-Key in den Einstellungen.`
  }
  finally {
    loading.value = false
  }
}

async function onSaveInvoice(): Promise<void> {
  if (!parsedInvoice.value || !selectedVehicleId.value)
    return

  const inv = parsedInvoice.value
  const rotatedImage = await autoRotateForDocument(imageBase64.value)
  const ocrCacheId = await hashImage(imageBase64.value)
  await invoicesStore.add({
    vehicleId: selectedVehicleId.value,
    workshopName: inv.workshopName || '',
    date: inv.date,
    totalAmount: inv.totalAmount || 0,
    currency: inv.currency || 'EUR',
    mileageAtService: inv.mileageAtService || 0,
    imageData: rotatedImage,
    ocrCacheId,
    items: inv.items || [],
  })

  if (inv.mileageAtService) {
    await vehiclesStore.updateMileage(selectedVehicleId.value, inv.mileageAtService)
  }

  for (const item of inv.items || []) {
    const normalized = item.category.toLowerCase().trim()
    const category = (MAINTENANCE_CATEGORIES as readonly string[]).includes(normalized)
      ? normalized
      : 'sonstiges'

    await maintenancesStore.add({
      vehicleId: selectedVehicleId.value,
      invoiceId: '',
      type: category,
      description: item.description,
      doneAt: inv.date,
      mileageAtService: inv.mileageAtService || 0,
      nextDueDate: '',
      nextDueMileage: 0,
      status: 'done',
    })
  }

  parsedInvoice.value = null
}

async function onSaveVehicleDoc(): Promise<void> {
  if (!parsedVehicleDoc.value)
    return

  const doc = parsedVehicleDoc.value
  await vehiclesStore.add({
    make: doc.make,
    model: doc.model,
    year: doc.year,
    mileage: doc.mileage || 0,
    licensePlate: doc.plate || '',
    vin: doc.vin || '',
  })

  parsedVehicleDoc.value = null
  router.push('/vehicles')
}

async function onSaveServiceBook(): Promise<void> {
  if (!parsedServiceBook.value || !selectedVehicleId.value)
    return

  const book = parsedServiceBook.value
  for (const entry of book.entries) {
    for (const item of entry.items) {
      const normalized = item.category.toLowerCase().trim()
      const category = (MAINTENANCE_CATEGORIES as readonly string[]).includes(normalized)
        ? normalized
        : 'sonstiges'

      await maintenancesStore.add({
        vehicleId: selectedVehicleId.value,
        invoiceId: '',
        type: category,
        description: item.description,
        doneAt: entry.date,
        mileageAtService: entry.mileage || 0,
        nextDueDate: '',
        nextDueMileage: 0,
        status: 'done',
      })
    }

    if (entry.mileage) {
      await vehiclesStore.updateMileage(selectedVehicleId.value, entry.mileage)
    }
  }

  if (book.manufacturerIntervals?.length) {
    const schedule = book.manufacturerIntervals.map(i => ({
      type: i.type.toLowerCase().trim(),
      label: i.type,
      intervalKm: i.intervalKm,
      intervalMonths: i.intervalMonths,
    }))
    await vehiclesStore.updateCustomSchedule(selectedVehicleId.value, schedule)
  }

  parsedServiceBook.value = null
}

function normalizeCategory(cat: string): string {
  const normalized = cat.toLowerCase().trim()
  return (MAINTENANCE_CATEGORIES as readonly string[]).includes(normalized)
    ? normalized
    : 'sonstiges'
}
</script>

<template>
  <main class="page-container">
    <h2 class="page-title">
      Dokument scannen
    </h2>

    <Tabs v-model:value="scanTab" @update:value="resetResults">
      <TabList>
        <Tab value="rechnung">
          <i class="pi pi-receipt tab-icon" /> Rechnung
        </Tab>
        <Tab value="fahrzeug">
          <i class="pi pi-car tab-icon" /> Kaufvertrag / Schein
        </Tab>
        <Tab value="serviceheft">
          <i class="pi pi-book tab-icon" /> Service-Heft
        </Tab>
      </TabList>
    </Tabs>

    <div v-if="scanTab !== 'fahrzeug'" class="vehicle-selector">
      <Select
        v-model="selectedVehicleId"
        :options="vehicleOptions"
        option-label="label"
        option-value="value"
        placeholder="Fahrzeug wählen"
        class="w-full"
      />
    </div>

    <InvoiceScanner @captured="onCaptured" />

    <div v-if="loading" class="loading-state">
      <ProgressSpinner style="width: 40px; height: 40px" />
      <div class="loading-text">
        {{ scanTab === 'rechnung' ? 'KI analysiert Rechnung...' : scanTab === 'fahrzeug' ? 'KI liest Fahrzeugdaten...' : 'KI analysiert Service-Heft...' }}
      </div>
    </div>

    <div v-if="error" class="error-state">
      {{ error }}
    </div>

    <InvoiceResult
      v-if="parsedInvoice"
      :result="parsedInvoice"
      @save="onSaveInvoice"
      @discard="parsedInvoice = null"
    />

    <Card v-if="parsedVehicleDoc" class="result-card">
      <template #title>
        Erkannte Fahrzeugdaten
      </template>
      <template #content>
        <div class="field-list">
          <div class="field-row">
            <span class="field-label">Dokumenttyp</span>
            <span class="field-value">{{ parsedVehicleDoc.documentType }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Marke</span>
            <span class="field-value">{{ parsedVehicleDoc.make }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Modell</span>
            <span class="field-value">{{ parsedVehicleDoc.model }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Baujahr</span>
            <span class="field-value">{{ parsedVehicleDoc.year }}</span>
          </div>
          <div v-if="parsedVehicleDoc.plate" class="field-row">
            <span class="field-label">Kennzeichen</span>
            <span class="field-value">{{ parsedVehicleDoc.plate }}</span>
          </div>
          <div v-if="parsedVehicleDoc.vin" class="field-row">
            <span class="field-label">VIN</span>
            <span class="field-value">{{ parsedVehicleDoc.vin }}</span>
          </div>
          <div v-if="parsedVehicleDoc.mileage" class="field-row">
            <span class="field-label">Kilometerstand</span>
            <span class="field-value">{{ parsedVehicleDoc.mileage?.toLocaleString('de-DE') }} km</span>
          </div>
          <div v-if="parsedVehicleDoc.engineType" class="field-row">
            <span class="field-label">Motor</span>
            <span class="field-value">{{ parsedVehicleDoc.engineType }} {{ parsedVehicleDoc.enginePower || '' }}</span>
          </div>
          <div v-if="parsedVehicleDoc.purchasePrice" class="field-row">
            <span class="field-label">Kaufpreis</span>
            <span class="field-value">{{ parsedVehicleDoc.purchasePrice?.toFixed(2) }} EUR</span>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="card-actions">
          <Button label="Fahrzeug anlegen" severity="primary" @click="onSaveVehicleDoc" />
          <Button label="Verwerfen" text @click="parsedVehicleDoc = null" />
        </div>
      </template>
    </Card>

    <Card v-if="parsedServiceBook" class="result-card">
      <template #title>
        Erkannte Service-Eintrage
      </template>
      <template #content>
        <div class="entries-list">
          <div v-for="(entry, i) in parsedServiceBook.entries" :key="i" class="entry-item">
            <div class="entry-header">
              {{ entry.date }} · {{ entry.mileage?.toLocaleString('de-DE') }} km
            </div>
            <div v-if="entry.workshopName" class="entry-workshop">
              {{ entry.workshopName }}
            </div>
            <div v-for="(item, j) in entry.items" :key="j" class="entry-detail">
              {{ item.description }} ({{ normalizeCategory(item.category) }})
            </div>
          </div>
        </div>

        <div v-if="parsedServiceBook.manufacturerIntervals?.length" class="intervals-section">
          <div class="intervals-title">
            Hersteller-Intervalle
          </div>
          <div class="intervals-list">
            <div v-for="(interval, i) in parsedServiceBook.manufacturerIntervals" :key="i" class="interval-item">
              <div class="interval-type">
                {{ interval.type }}
              </div>
              <div class="interval-values">
                {{ interval.intervalKm > 0 ? `alle ${interval.intervalKm.toLocaleString('de-DE')} km` : '' }}
                {{ interval.intervalKm > 0 && interval.intervalMonths > 0 ? ' / ' : '' }}
                {{ interval.intervalMonths > 0 ? `alle ${interval.intervalMonths} Monate` : '' }}
              </div>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="card-actions">
          <Button label="Zu Fahrzeug hinzufugen" severity="primary" @click="onSaveServiceBook" />
          <Button label="Verwerfen" text @click="parsedServiceBook = null" />
        </div>
      </template>
    </Card>
  </main>
</template>

<style scoped>
.page-container {
  padding: 1rem;
  max-width: 800px;
  margin: 0 auto;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 500;
  margin: 0 0 1rem;
}

.tab-icon {
  margin-right: 0.5rem;
}

.vehicle-selector {
  margin: 1rem 0;
}

.w-full {
  width: 100%;
}

.loading-state {
  text-align: center;
  margin-top: 1rem;
}

.loading-text {
  margin-top: 0.5rem;
  color: var(--text-color-secondary);
}

.error-state {
  margin-top: 1rem;
  color: var(--red-500);
}

.result-card {
  margin-top: 1rem;
}

.field-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field-row {
  display: flex;
  justify-content: space-between;
  padding: 0.25rem 0;
}

.field-label {
  color: var(--text-color-secondary);
}

.field-value {
  font-weight: 500;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
}

.entries-list {
  border: 1px solid var(--surface-border);
  border-radius: var(--border-radius);
}

.entry-item {
  padding: 0.75rem;
  border-bottom: 1px solid var(--surface-border);
}

.entry-item:last-child {
  border-bottom: none;
}

.entry-header {
  font-weight: 500;
}

.entry-workshop,
.entry-detail {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.intervals-section {
  margin-top: 1rem;
}

.intervals-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.intervals-list {
  border: 1px solid var(--surface-border);
  border-radius: var(--border-radius);
}

.interval-item {
  padding: 0.75rem;
  border-bottom: 1px solid var(--surface-border);
}

.interval-item:last-child {
  border-bottom: none;
}

.interval-type {
  font-weight: 500;
}

.interval-values {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}
</style>
