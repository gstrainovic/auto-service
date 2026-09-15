<script setup lang="ts">
import Button from 'primevue/button'
import FloatLabel from 'primevue/floatlabel'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import { reactive, ref, watchEffect } from 'vue'
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

const emit = defineEmits<{ save: [vehicle: typeof form] }>()

const form = reactive({
  make: '',
  model: '',
  year: new Date().getFullYear(),
  mileage: 0,
  licensePlate: '',
  vin: '',
})

watchEffect(() => {
  if (props.initialData) {
    form.make = props.initialData.make
    form.model = props.initialData.model
    form.year = props.initialData.year
    form.mileage = props.initialData.mileage
    form.licensePlate = props.initialData.licensePlate
    form.vin = props.initialData.vin || ''
  }
})

// Neues Fahrzeug: Fahrzeugausweis oder Kaufvertrag lesen und leere Felder füllen (beim Bearbeiten nicht angeboten)
const scan = useVehicleScan()
// Baujahr ist mit dem aktuellen Jahr vorbelegt; erst eine Eingabe des Nutzers schützt es vor dem Scan
const yearTouched = ref(false)

async function onDocument(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file)
    return
  const fields = await scan.handleFile(file)
  if (fields)
    Object.assign(form, fillVehicleFields({ ...form }, fields, { yearTouched: yearTouched.value }))
}

function onSubmit(event: Event): void {
  event.preventDefault()
  emit('save', { ...form })
}
</script>

<template>
  <form class="vehicle-form" @submit="onSubmit">
    <div v-if="!initialData" class="doc-scan">
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
        required
        class="w-full"
        @input="yearTouched = true"
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
        required
        class="w-full"
      />
      <label for="mileage">Kilometerstand</label>
    </FloatLabel>

    <FloatLabel>
      <InputText
        id="licensePlate"
        v-model="form.licensePlate"
        class="w-full"
      />
      <label for="licensePlate">Kennzeichen</label>
    </FloatLabel>

    <FloatLabel>
      <InputText
        id="vin"
        v-model="form.vin"
        class="w-full"
      />
      <label for="vin">FIN (Fahrzeug-Identnummer)</label>
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
