<script setup lang="ts">
import type { ParsedInvoice, ParsedServiceBook, ParsedVehicleDocument } from '../services/ai'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import InvoiceResult from '../components/InvoiceResult.vue'
import InvoiceScanner from '../components/InvoiceScanner.vue'
import { MAINTENANCE_CATEGORIES, parseInvoice, parseServiceBook, parseVehicleDocument } from '../services/ai'
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

// Invoice scan state
const parsedInvoice = ref<ParsedInvoice | null>(null)

// Vehicle document scan state
const parsedVehicleDoc = ref<ParsedVehicleDocument | null>(null)

// Service book scan state
const parsedServiceBook = ref<ParsedServiceBook | null>(null)

const vehicleOptions = computed(() =>
  vehiclesStore.vehicles.map(v => ({
    label: `${v.make} ${v.model} (${v.licensePlate})`,
    value: v.id,
  })),
)

onMounted(() => vehiclesStore.load())

function resetResults() {
  parsedInvoice.value = null
  parsedVehicleDoc.value = null
  parsedServiceBook.value = null
  error.value = ''
}

async function onCaptured(base64: string) {
  imageBase64.value = base64
  loading.value = true
  resetResults()

  try {
    if (scanTab.value === 'rechnung') {
      parsedInvoice.value = await parseInvoice(
        base64,
        settingsStore.aiProvider,
        settingsStore.aiApiKey,
        settingsStore.ollamaUrl,
        settingsStore.ollamaModel,
      )
    }
    else if (scanTab.value === 'fahrzeug') {
      parsedVehicleDoc.value = await parseVehicleDocument(
        base64,
        settingsStore.aiProvider,
        settingsStore.aiApiKey,
        settingsStore.ollamaUrl,
        settingsStore.ollamaModel,
      )
    }
    else if (scanTab.value === 'serviceheft') {
      parsedServiceBook.value = await parseServiceBook(
        base64,
        settingsStore.aiProvider,
        settingsStore.aiApiKey,
        settingsStore.ollamaUrl,
        settingsStore.ollamaModel,
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

async function onSaveInvoice() {
  if (!parsedInvoice.value || !selectedVehicleId.value)
    return

  const inv = parsedInvoice.value
  await invoicesStore.add({
    vehicleId: selectedVehicleId.value,
    workshopName: inv.workshopName || '',
    date: inv.date,
    totalAmount: inv.totalAmount || 0,
    mileageAtService: inv.mileageAtService || 0,
    imageData: imageBase64.value,
    rawText: '',
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

async function onSaveVehicleDoc() {
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

async function onSaveServiceBook() {
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
  <q-page padding>
    <h5>Dokument scannen</h5>

    <q-tabs v-model="scanTab" align="left" class="q-mb-md" @update:model-value="resetResults">
      <q-tab name="rechnung" label="Rechnung" icon="receipt" />
      <q-tab name="fahrzeug" label="Kaufvertrag / Schein" icon="directions_car" />
      <q-tab name="serviceheft" label="Service-Heft" icon="menu_book" />
    </q-tabs>

    <!-- Vehicle selector for rechnung and serviceheft -->
    <q-select
      v-if="scanTab !== 'fahrzeug'"
      v-model="selectedVehicleId"
      :options="vehicleOptions"
      label="Fahrzeug wählen"
      outlined
      emit-value
      map-options
      class="q-mb-md"
    />

    <InvoiceScanner @captured="onCaptured" />

    <div v-if="loading" class="q-mt-md text-center">
      <q-spinner-dots size="40px" />
      <div class="q-mt-sm">
        {{ scanTab === 'rechnung' ? 'KI analysiert Rechnung...' : scanTab === 'fahrzeug' ? 'KI liest Fahrzeugdaten...' : 'KI analysiert Service-Heft...' }}
      </div>
    </div>

    <div v-if="error" class="q-mt-md text-negative">
      {{ error }}
    </div>

    <!-- Invoice result -->
    <InvoiceResult
      v-if="parsedInvoice"
      :result="parsedInvoice"
      @save="onSaveInvoice"
      @discard="parsedInvoice = null"
    />

    <!-- Vehicle document result -->
    <q-card v-if="parsedVehicleDoc" class="q-mt-md">
      <q-card-section>
        <div class="text-h6">
          Erkannte Fahrzeugdaten
        </div>
      </q-card-section>
      <q-card-section>
        <q-field label="Dokumenttyp" stack-label borderless>
          <template #control>
            {{ parsedVehicleDoc.documentType }}
          </template>
        </q-field>
        <q-field label="Marke" stack-label borderless>
          <template #control>
            {{ parsedVehicleDoc.make }}
          </template>
        </q-field>
        <q-field label="Modell" stack-label borderless>
          <template #control>
            {{ parsedVehicleDoc.model }}
          </template>
        </q-field>
        <q-field label="Baujahr" stack-label borderless>
          <template #control>
            {{ parsedVehicleDoc.year }}
          </template>
        </q-field>
        <q-field v-if="parsedVehicleDoc.plate" label="Kennzeichen" stack-label borderless>
          <template #control>
            {{ parsedVehicleDoc.plate }}
          </template>
        </q-field>
        <q-field v-if="parsedVehicleDoc.vin" label="VIN" stack-label borderless>
          <template #control>
            {{ parsedVehicleDoc.vin }}
          </template>
        </q-field>
        <q-field v-if="parsedVehicleDoc.mileage" label="Kilometerstand" stack-label borderless>
          <template #control>
            {{ parsedVehicleDoc.mileage?.toLocaleString('de-DE') }} km
          </template>
        </q-field>
        <q-field v-if="parsedVehicleDoc.engineType" label="Motor" stack-label borderless>
          <template #control>
            {{ parsedVehicleDoc.engineType }} {{ parsedVehicleDoc.enginePower || '' }}
          </template>
        </q-field>
        <q-field v-if="parsedVehicleDoc.purchasePrice" label="Kaufpreis" stack-label borderless>
          <template #control>
            {{ parsedVehicleDoc.purchasePrice?.toFixed(2) }} €
          </template>
        </q-field>
      </q-card-section>
      <q-card-actions>
        <q-btn color="primary" label="Fahrzeug anlegen" @click="onSaveVehicleDoc" />
        <q-btn flat label="Verwerfen" @click="parsedVehicleDoc = null" />
      </q-card-actions>
    </q-card>

    <!-- Service book result -->
    <q-card v-if="parsedServiceBook" class="q-mt-md">
      <q-card-section>
        <div class="text-h6">
          Erkannte Service-Einträge
        </div>
      </q-card-section>
      <q-card-section>
        <q-list bordered separator>
          <q-item v-for="(entry, i) in parsedServiceBook.entries" :key="i">
            <q-item-section>
              <q-item-label>
                {{ entry.date }} · {{ entry.mileage?.toLocaleString('de-DE') }} km
              </q-item-label>
              <q-item-label v-if="entry.workshopName" caption>
                {{ entry.workshopName }}
              </q-item-label>
              <q-item-label v-for="(item, j) in entry.items" :key="j" caption>
                {{ item.description }} ({{ normalizeCategory(item.category) }})
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>

        <div v-if="parsedServiceBook.manufacturerIntervals?.length" class="q-mt-md">
          <div class="text-subtitle1">
            Hersteller-Intervalle
          </div>
          <q-list bordered separator>
            <q-item v-for="(interval, i) in parsedServiceBook.manufacturerIntervals" :key="i">
              <q-item-section>
                <q-item-label>{{ interval.type }}</q-item-label>
                <q-item-label caption>
                  {{ interval.intervalKm > 0 ? `alle ${interval.intervalKm.toLocaleString('de-DE')} km` : '' }}
                  {{ interval.intervalKm > 0 && interval.intervalMonths > 0 ? ' / ' : '' }}
                  {{ interval.intervalMonths > 0 ? `alle ${interval.intervalMonths} Monate` : '' }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </q-card-section>
      <q-card-actions>
        <q-btn color="primary" label="Zu Fahrzeug hinzufügen" @click="onSaveServiceBook" />
        <q-btn flat label="Verwerfen" @click="parsedServiceBook = null" />
      </q-card-actions>
    </q-card>
  </q-page>
</template>
