<script setup lang="ts">
import type { Vehicle } from '../stores/vehicles'
import Badge from 'primevue/badge'
import Button from 'primevue/button'
import Card from 'primevue/card'
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { formatNumber } from '../lib/locale'
import { checkDueMaintenances, getMaintenanceSchedule, vehicleDueStatus } from '../services/maintenance-schedule'
import { useMaintenancesStore } from '../stores/maintenances'

const props = defineProps<{ vehicle: Vehicle }>()
const emit = defineEmits<{ delete: [id: string] }>()
const router = useRouter()

// Fälligkeit live aus dem Store (nach «Erledigt eintragen» oder einer Rechnung sofort aktuell)
const maintenancesStore = useMaintenancesStore()
onMounted(() => maintenancesStore.load())

const dueItems = computed(() => checkDueMaintenances({
  currentMileage: props.vehicle.mileage,
  // Nur erledigte Einträge zählen, geplante sind noch keine Wartung
  lastMaintenances: maintenancesStore.maintenances
    .filter(m => m.vehicleId === props.vehicle.id && m.status === 'done')
    .map(m => ({ type: m.type, mileageAtService: m.mileageAtService, doneAt: m.doneAt })),
  schedule: getMaintenanceSchedule(props.vehicle.customSchedule as any),
}))
const maintenanceStatus = computed(() => vehicleDueStatus(dueItems.value))
// Arbeit, die den Status auslöst (z. B. «Ölwechsel»), für den Badge-Text
const statusItemLabel = computed(() => dueItems.value.find(i => i.status === maintenanceStatus.value)?.label ?? '')

const statusSeverity = computed(() => {
  if (maintenanceStatus.value === 'overdue')
    return 'danger'
  if (maintenanceStatus.value === 'due')
    return 'warn'
  if (maintenanceStatus.value === 'unknown')
    return 'secondary'
  return 'success'
})

const statusLabel = computed(() => {
  const item = statusItemLabel.value ? `${statusItemLabel.value} ` : ''
  if (maintenanceStatus.value === 'overdue')
    return `${item}überfällig`
  if (maintenanceStatus.value === 'due')
    return `${item}bald fällig`
  if (maintenanceStatus.value === 'unknown')
    return 'Noch keine Wartung erfasst'
  return 'OK'
})

function navigateToDetail(): void {
  router.push(`/vehicles/${props.vehicle.id}`)
}

function onDelete(event: Event): void {
  event.stopPropagation()
  emit('delete', props.vehicle.id)
}
</script>

<template>
  <Card class="vehicle-card" @click="navigateToDetail">
    <template #title>
      <div class="title-row">
        <span>{{ vehicle.make }} {{ vehicle.model }}</span>
        <Badge :value="statusLabel" :severity="statusSeverity" />
      </div>
    </template>
    <template #subtitle>
      <div class="subtitle-row">
        <span>{{ vehicle.year }}</span>
        <Badge v-if="vehicle.licensePlate" :value="vehicle.licensePlate" severity="secondary" class="license-badge" />
      </div>
    </template>
    <template #content>
      <div v-if="vehicle.mileage" class="mileage">
        <i class="pi pi-gauge" />
        {{ formatNumber(vehicle.mileage) }} km
      </div>
    </template>
    <template #footer>
      <div class="card-actions">
        <Button
          v-tooltip.top="'Fahrzeug löschen'"
          icon="pi pi-trash"
          severity="secondary"
          text
          rounded
          aria-label="Löschen"
          @click="onDelete"
        />
      </div>
    </template>
  </Card>
</template>

<style scoped>
.vehicle-card {
  cursor: pointer;
  margin-bottom: 1rem;
  transition: box-shadow 0.2s, transform 0.2s;
}

.vehicle-card:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.mileage {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--p-text-muted-color);
}

.card-actions {
  display: flex;
  justify-content: flex-end;
}

.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.subtitle-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.license-badge {
  font-size: 0.75rem;
}
</style>
