<script setup lang="ts">
import type { ParsedInvoice } from '../services/ai'
import { computed, onMounted, ref } from 'vue'
import InvoiceResult from '../components/InvoiceResult.vue'
import InvoiceScanner from '../components/InvoiceScanner.vue'
import { parseInvoice } from '../services/ai'
import { useInvoicesStore } from '../stores/invoices'
import { useMaintenancesStore } from '../stores/maintenances'
import { useSettingsStore } from '../stores/settings'
import { useVehiclesStore } from '../stores/vehicles'

const vehiclesStore = useVehiclesStore()
const invoicesStore = useInvoicesStore()
const maintenancesStore = useMaintenancesStore()
const settingsStore = useSettingsStore()

const selectedVehicleId = ref('')
const parsedInvoice = ref<ParsedInvoice | null>(null)
const imageBase64 = ref('')
const loading = ref(false)
const error = ref('')

const vehicleOptions = computed(() =>
  vehiclesStore.vehicles.map(v => ({
    label: `${v.make} ${v.model} (${v.licensePlate})`,
    value: v.id,
  })),
)

onMounted(() => vehiclesStore.load())

async function onCaptured(base64: string) {
  imageBase64.value = base64
  loading.value = true
  error.value = ''
  parsedInvoice.value = null

  try {
    parsedInvoice.value = await parseInvoice(
      base64,
      settingsStore.aiProvider,
      settingsStore.aiApiKey,
      settingsStore.ollamaUrl,
      settingsStore.ollamaModel,
    )
  }
  catch (e: any) {
    error.value = `Fehler: ${e.message}. Prüfe deinen API-Key in den Einstellungen.`
  }
  finally {
    loading.value = false
  }
}

async function onSave() {
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
    await maintenancesStore.add({
      vehicleId: selectedVehicleId.value,
      invoiceId: '',
      type: item.category,
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
</script>

<template>
  <q-page padding>
    <h5>Rechnung scannen</h5>

    <q-select
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
        KI analysiert Rechnung...
      </div>
    </div>

    <div v-if="error" class="q-mt-md text-negative">
      {{ error }}
    </div>

    <InvoiceResult
      v-if="parsedInvoice"
      :result="parsedInvoice"
      @save="onSave"
      @discard="parsedInvoice = null"
    />
  </q-page>
</template>
