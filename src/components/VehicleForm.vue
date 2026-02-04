<script setup lang="ts">
import Button from 'primevue/button'
import FloatLabel from 'primevue/floatlabel'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import { reactive, watchEffect } from 'vue'

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

function onSubmit(event: Event): void {
  event.preventDefault()
  emit('save', { ...form })
}
</script>

<template>
  <form class="vehicle-form" @submit="onSubmit">
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
      />
      <label for="year">Baujahr</label>
    </FloatLabel>

    <FloatLabel>
      <InputNumber
        v-model="form.mileage"
        input-id="mileage"
        :min="0"
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

    <Button type="submit" label="Speichern" />
  </form>
</template>

<style scoped>
.vehicle-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.w-full {
  width: 100%;
}
</style>
