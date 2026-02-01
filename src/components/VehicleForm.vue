<script setup lang="ts">
import { reactive, watchEffect } from 'vue'

const props = defineProps<{
  initialData?: {
    make: string
    model: string
    year: number
    mileage: number
    licensePlate: string
    vin: string
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
    form.vin = props.initialData.vin
  }
})

function onSubmit() {
  emit('save', { ...form })
}
</script>

<template>
  <q-form class="q-gutter-md" @submit="onSubmit">
    <q-input v-model="form.make" label="Marke *" outlined required />
    <q-input v-model="form.model" label="Modell *" outlined required />
    <q-input v-model.number="form.year" label="Baujahr *" type="number" outlined required />
    <q-input v-model.number="form.mileage" label="Kilometerstand *" type="number" outlined required />
    <q-input v-model="form.licensePlate" label="Kennzeichen" outlined />
    <q-input v-model="form.vin" label="FIN (Fahrzeug-Identnummer)" outlined />
    <q-btn type="submit" label="Speichern" color="primary" />
  </q-form>
</template>
