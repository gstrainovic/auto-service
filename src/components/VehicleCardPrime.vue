<script setup lang="ts">
import type { Vehicle } from '../stores/vehicles'
import Button from 'primevue/button'
import Card from 'primevue/card'
import { useRouter } from 'vue-router'

const props = defineProps<{ vehicle: Vehicle }>()
const emit = defineEmits<{ delete: [id: string] }>()
const router = useRouter()

function handleClick() {
  router.push(`/vehicles/${props.vehicle.id}`)
}

function handleDelete(event: Event) {
  event.stopPropagation()
  emit('delete', props.vehicle.id)
}
</script>

<template>
  <Card class="mb-3 cursor-pointer" @click="handleClick">
    <template #title>
      {{ vehicle.make }} {{ vehicle.model }}
    </template>
    <template #subtitle>
      {{ vehicle.year }} · {{ vehicle.licensePlate }}
    </template>
    <template #content>
      <i class="pi pi-car mr-2" />
      {{ vehicle.mileage.toLocaleString('de-DE') }} km
    </template>
    <template #footer>
      <div class="flex justify-end">
        <Button
          icon="pi pi-trash"
          severity="danger"
          text
          @click="handleDelete"
        />
      </div>
    </template>
  </Card>
</template>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
</style>
