<script setup lang="ts">
import type { Vehicle } from '../stores/vehicles'

defineProps<{ vehicle: Vehicle }>()
defineEmits<{ delete: [id: string] }>()
</script>

<template>
  <q-card class="q-mb-md cursor-pointer" @click="$router.push(`/vehicles/${vehicle.id}`)">
    <q-card-section>
      <div class="text-h6">
        {{ vehicle.make }} {{ vehicle.model }}
      </div>
      <div class="text-subtitle2">
        {{ vehicle.year }} · {{ vehicle.licensePlate }}
      </div>
    </q-card-section>
    <q-card-section>
      <q-icon name="speed" /> {{ vehicle.mileage.toLocaleString('de-DE') }} km
    </q-card-section>
    <q-card-actions align="right">
      <q-btn flat color="negative" icon="delete" @click.stop="$emit('delete', vehicle.id)" />
    </q-card-actions>
  </q-card>
</template>
