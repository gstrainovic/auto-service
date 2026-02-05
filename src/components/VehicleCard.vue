<script setup lang="ts">
import type { Vehicle } from '../stores/vehicles'
import Badge from 'primevue/badge'
import Button from 'primevue/button'
import Card from 'primevue/card'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '../lib/instantdb'
import { checkDueMaintenances, getMaintenanceSchedule } from '../services/maintenance-schedule'

const props = defineProps<{ vehicle: Vehicle }>()
const emit = defineEmits<{ delete: [id: string] }>()
const router = useRouter()

const maintenanceStatus = ref<'ok' | 'due' | 'overdue'>('ok')

onMounted(async () => {
  try {
    const result = await db.queryOnce({ maintenances: {} })
    const allMaintenances = result.data.maintenances || []
    const schedule = getMaintenanceSchedule(props.vehicle.customSchedule as any)
    const vehicleMaintenances = allMaintenances.filter((m: any) => m.vehicleId === props.vehicle.id)
    const lastMaintenances = vehicleMaintenances.map((m: any) => ({
      type: m.type,
      mileageAtService: m.mileageAtService,
      doneAt: m.doneAt,
    }))

    const dueItems = checkDueMaintenances({
      currentMileage: props.vehicle.mileage,
      lastMaintenances,
      schedule,
    })

    if (dueItems.some(i => i.status === 'overdue')) {
      maintenanceStatus.value = 'overdue'
    }
    else if (dueItems.some(i => i.status === 'due')) {
      maintenanceStatus.value = 'due'
    }
    else {
      maintenanceStatus.value = 'ok'
    }
  }
  catch {}
})

const statusSeverity = computed(() => {
  if (maintenanceStatus.value === 'overdue')
    return 'danger'
  if (maintenanceStatus.value === 'due')
    return 'warn'
  return 'success'
})

const statusLabel = computed(() => {
  if (maintenanceStatus.value === 'overdue')
    return 'Überfällig'
  if (maintenanceStatus.value === 'due')
    return 'Fällig'
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
      <div class="mileage">
        <i class="pi pi-gauge" />
        {{ vehicle.mileage.toLocaleString('de-DE') }} km
      </div>
    </template>
    <template #footer>
      <div class="card-actions">
        <Button
          icon="pi pi-trash"
          severity="danger"
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
