<script setup lang="ts">
/**
 * Kilometerstand schnell nachführen. Der Stand steuert die Fälligkeit nach Kilometern, darum muss er ohne Umweg
 * über das Bearbeiten-Formular änderbar sein (Dashboard und Fahrzeugseite).
 */
import type { Vehicle } from '../stores/vehicles'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import { computed, ref, watch } from 'vue'
import { formatNumber, LOCALE } from '../lib/locale'
import { useVehiclesStore } from '../stores/vehicles'

const props = defineProps<{ vehicle: Vehicle | null }>()
const emit = defineEmits<{ close: [] }>()

const store = useVehiclesStore()
const mileage = ref<number | null>(null)
const saving = ref(false)

watch(() => props.vehicle, (v) => {
  mileage.value = v?.mileage || null
}, { immediate: true })

const lower = computed(() => !!props.vehicle && !!mileage.value && mileage.value < (props.vehicle.mileage || 0))

async function save(): Promise<void> {
  if (!props.vehicle || !mileage.value)
    return
  saving.value = true
  try {
    await store.updateMileage(props.vehicle.id, mileage.value)
    emit('close')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog
    :visible="!!vehicle"
    modal
    header="Kilometerstand"
    data-testid="mileage-dialog"
    :style="{ width: 'min(420px, 94vw)' }"
    @update:visible="emit('close')"
  >
    <p class="intro">
      {{ vehicle?.make }} {{ vehicle?.model }}, bisher {{ formatNumber(vehicle?.mileage) }} km.
    </p>
    <InputNumber
      v-model="mileage"
      input-id="mileage-input"
      :locale="LOCALE"
      suffix=" km"
      aria-label="Kilometerstand"
      autofocus
      fluid
      @keyup.enter="save"
    />
    <small v-if="lower" class="warn">Niedriger als bisher. Nur eintragen, wenn der alte Stand falsch war.</small>
    <template #footer>
      <Button label="Abbrechen" text severity="secondary" @click="emit('close')" />
      <Button label="Speichern" :disabled="!mileage" :loading="saving" @click="save" />
    </template>
  </Dialog>
</template>

<style scoped>
.intro {
  margin: 0 0 0.75rem;
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
}

.warn {
  display: block;
  margin-top: 0.5rem;
  color: var(--status-warning);
}
</style>
