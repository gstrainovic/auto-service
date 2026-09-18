<script setup lang="ts">
import Button from 'primevue/button'
import FloatLabel from 'primevue/floatlabel'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import { reactive, watchEffect } from 'vue'
import { useVehicleScan } from '../composables/useVehicleScan'
import { LOCALE } from '../lib/locale'
import { fillVehicleFields } from '../services/vehicle-scan'

const props = defineProps<{
  initialData?: {
    make: string
    model: string
    year: number
    mileage: number
    licensePlate: string
    vin?: string
  }
}>()

const emit = defineEmits<{ save: [vehicle: VehicleFormData] }>()

interface VehicleFormData {
  make: string
  model: string
  year: number
  mileage: number
  licensePlate: string
  vin: string
}

// Baujahr und Kilometerstand starten leer: 0 heisst unbekannt und wird nirgends angezeigt.
// Vorbelegte Werte (aktuelles Jahr, «0 km») lasen Laien als Fehler oder liessen sie beim Gebrauchtwagen stehen.
const form = reactive({
  make: '',
  model: '',
  year: null as number | null,
  mileage: null as number | null,
  licensePlate: '',
  vin: '',
})

watchEffect(() => {
  if (props.initialData) {
    form.make = props.initialData.make
    form.model = props.initialData.model
    form.year = props.initialData.year || null
    form.mileage = props.initialData.mileage || null
    form.licensePlate = props.initialData.licensePlate
    form.vin = props.initialData.vin || ''
  }
})

function toData(): VehicleFormData {
  return { ...form, year: form.year ?? 0, mileage: form.mileage ?? 0 }
}

// Fahrzeugausweis oder Kaufvertrag lesen und leere Felder füllen; auch beim Bearbeiten, dort ergänzt der Ausweis
// z. B. die Fahrgestellnummer nach einem Kaufvertrag (Schritt «Fahrzeugausweis» der Einrichtung)
const scan = useVehicleScan()

async function onDocument(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file)
    return
  const fields = await scan.handleFile(file)
  if (fields) {
    const filled = fillVehicleFields(toData(), fields)
    Object.assign(form, { ...filled, year: filled.year || null, mileage: filled.mileage || null })
  }
}

function onSubmit(event: Event): void {
  event.preventDefault()
  emit('save', toData())
}
</script>

<template>
  <form class="vehicle-form" @submit="onSubmit">
    <div class="doc-scan">
      <label class="upload-label" :class="{ disabled: scan.scanning.value }">
        <i class="pi pi-id-card" />
        Fahrzeugausweis fotografieren
        <input
          type="file"
          accept="image/*,application/pdf"
          class="file-input"
          :disabled="scan.scanning.value"
          @change="onDocument"
        >
      </label>
      <small v-if="scan.scanning.value" class="scan-status" role="status">
        <i class="pi pi-spin pi-spinner" /> Dokument wird gelesen …
      </small>
      <small v-else-if="scan.message.value" class="scan-status" :class="{ error: scan.failed.value }" role="status">
        {{ scan.message.value }}
      </small>
      <small v-else class="scan-status">Füllt Marke, Modell, Jahr, Kontrollschild und Fahrgestellnummer aus. Kaufvertrag geht auch.</small>
      <img v-if="scan.preview.value" :src="scan.preview.value" alt="Dokument" class="doc-preview">
    </div>

    <FloatLabel>
      <InputText
        id="make"
        v-model="form.make"
        required
        class="w-full"
      />
      <label for="make">Marke</label>
    </FloatLabel>

    <FloatLabel>
      <InputText
        id="model"
        v-model="form.model"
        required
        class="w-full"
      />
      <label for="model">Modell</label>
    </FloatLabel>

    <FloatLabel>
      <InputNumber
        v-model="form.year"
        input-id="year"
        :use-grouping="false"
        :min="1886"
        :max="new Date().getFullYear() + 1"
        class="w-full"
      />
      <label for="year">Baujahr</label>
    </FloatLabel>

    <FloatLabel>
      <InputNumber
        v-model="form.mileage"
        input-id="mileage"
        :min="0"
        :locale="LOCALE"
        suffix=" km"
        class="w-full"
      />
      <label for="mileage">Kilometerstand</label>
    </FloatLabel>

    <!-- Schweizer Begriffe wie auf dem Fahrzeugausweis (Feld 15 und 23) -->
    <FloatLabel>
      <InputText
        id="licensePlate"
        v-model="form.licensePlate"
        class="w-full"
      />
      <label for="licensePlate">Kontrollschild</label>
    </FloatLabel>

    <FloatLabel>
      <InputText
        id="vin"
        v-model="form.vin"
        class="w-full"
      />
      <label for="vin">Fahrgestellnummer</label>
    </FloatLabel>

    <Button type="submit" label="Speichern" :disabled="scan.scanning.value" />
  </form>
</template>

<style scoped>
.vehicle-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.doc-scan {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.upload-label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px dashed var(--surface-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--p-text-muted-color);
}

.upload-label:hover {
  border-color: var(--p-primary-color);
  color: var(--p-primary-color);
}

.upload-label.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

.scan-status {
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
}

.scan-status.error {
  color: var(--status-error);
}

.doc-preview {
  max-width: 220px;
  border-radius: var(--radius-md);
  border: 1px solid var(--surface-border);
}

.w-full {
  width: 100%;
}
</style>
