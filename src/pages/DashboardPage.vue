<script setup lang="ts">
import type { DueResult } from '../services/maintenance-schedule'
import Badge from 'primevue/badge'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { db, tx } from '../lib/instantdb'
import { checkDueMaintenances, getMaintenanceSchedule } from '../services/maintenance-schedule'
import { useVehiclesStore } from '../stores/vehicles'

const router = useRouter()
const vehiclesStore = useVehiclesStore()
const dueMap = ref<Record<string, DueResult[]>>({})
const confirmDelete = ref<{ vehicleId: string, type: string, label: string } | null>(null)
onMounted(async () => {
  await vehiclesStore.load()
  await computeDue()
})

watch(() => vehiclesStore.vehicles, computeDue, { deep: true })

async function computeDue() {
  const result = await db.queryOnce({ maintenances: {} })
  const allMaintenances = result.data.maintenances || []

  for (const vehicle of vehiclesStore.vehicles) {
    const schedule = getMaintenanceSchedule(vehicle.customSchedule as any)
    const vehicleMaintenances = allMaintenances.filter((m: any) => m.vehicleId === vehicle.id)
    const lastMaintenances = vehicleMaintenances.map((m: any) => ({
      type: m.type,
      mileageAtService: m.mileageAtService,
      doneAt: m.doneAt,
    }))

    dueMap.value[vehicle.id] = checkDueMaintenances({
      currentMileage: vehicle.mileage,
      lastMaintenances,
      schedule,
    })
  }
}

async function deleteMaintenance(vehicleId: string, type: string) {
  const result = await db.queryOnce({ maintenances: {} })
  const maintenances = (result.data.maintenances || [])
    .filter((m: any) => m.vehicleId === vehicleId && m.type === type)
  if (maintenances.length) {
    await db.transact(maintenances.map((m: any) => tx.maintenances[m.id].delete()))
  }
  confirmDelete.value = null
  await computeDue()
}

function getStatusIcon(status: string): string {
  if (status === 'overdue')
    return 'pi pi-exclamation-triangle'
  if (status === 'due')
    return 'pi pi-clock'
  return 'pi pi-check-circle'
}

function getStatusColor(status: string): string {
  if (status === 'overdue')
    return 'var(--p-red-500)'
  if (status === 'due')
    return 'var(--p-yellow-500)'
  return 'var(--p-green-500)'
}

function getStatusSeverity(status: string): 'danger' | 'warn' | 'success' {
  if (status === 'overdue')
    return 'danger'
  if (status === 'due')
    return 'warn'
  return 'success'
}

function getStatusLabel(status: string): string {
  if (status === 'overdue')
    return 'Überfällig'
  if (status === 'due')
    return 'Fällig'
  return 'OK'
}

function getDueCounts(vehicleId: string): { due: number, total: number } {
  const items = dueMap.value[vehicleId] || []
  const due = items.filter(i => i.status === 'due' || i.status === 'overdue').length
  return { due, total: items.length }
}
</script>

<template>
  <main class="page-container">
    <h2 class="page-title">
      Dashboard
    </h2>

    <div v-if="vehiclesStore.vehicles.length === 0" class="empty-state">
      <i class="pi pi-car empty-icon" />
      <div class="empty-text">
        Füge dein erstes Fahrzeug hinzu um loszulegen.
      </div>
      <Button
        label="Fahrzeug hinzufügen"
        icon="pi pi-plus"
        @click="router.push('/vehicles?action=add')"
      />
    </div>

    <div v-for="vehicle in vehiclesStore.vehicles" :key="vehicle.id" class="vehicle-section">
      <h3 class="vehicle-title">
        {{ vehicle.make }} {{ vehicle.model }}
      </h3>
      <div class="vehicle-subtitle">
        {{ vehicle.mileage.toLocaleString('de-DE') }} km · {{ vehicle.licensePlate }}
        <Badge
          v-if="getDueCounts(vehicle.id).total > 0"
          class="vehicle-progress"
          :value="`${getDueCounts(vehicle.id).due}/${getDueCounts(vehicle.id).total} fällig`"
          :severity="getDueCounts(vehicle.id).due > 0 ? 'warn' : 'success'"
        />
      </div>

      <Message
        v-if="!vehicle.customSchedule?.length"
        severity="warn"
        :closable="false"
        class="schedule-hint"
      >
        <template #icon>
          <i class="pi pi-info-circle" />
        </template>
        Allgemeine Wartungsintervalle — Service-Heft im Chat hochladen für genaue Intervalle.
      </Message>

      <div v-if="dueMap[vehicle.id]?.length" class="maintenance-list">
        <div v-for="item in dueMap[vehicle.id]" :key="item.type" class="maintenance-item">
          <div class="maintenance-icon">
            <i :class="getStatusIcon(item.status)" :style="{ color: getStatusColor(item.status) }" />
          </div>
          <div class="maintenance-content">
            <div class="maintenance-label">
              {{ item.label }}
            </div>
            <div v-if="item.lastDoneAt" class="maintenance-caption">
              Zuletzt: {{ item.lastDoneAt }} bei {{ item.lastMileage?.toLocaleString('de-DE') }} km
            </div>
          </div>
          <div class="maintenance-actions">
            <Badge
              :value="getStatusLabel(item.status)"
              :severity="getStatusSeverity(item.status)"
            />
            <Button
              v-if="item.lastDoneAt"
              icon="pi pi-trash"
              text
              rounded
              size="small"
              severity="secondary"
              @click="confirmDelete = { vehicleId: vehicle.id, type: item.type, label: item.label }"
            />
          </div>
        </div>
      </div>
    </div>

    <Dialog
      :visible="!!confirmDelete"
      header="Wartungseintrag löschen?"
      modal
      @update:visible="confirmDelete = null"
    >
      <p>
        Alle Einträge für <strong>{{ confirmDelete?.label }}</strong> werden gelöscht.
        Diese Aktion kann nicht rückgängig gemacht werden.
      </p>
      <template #footer>
        <Button
          label="Abbrechen"
          text
          @click="confirmDelete = null"
        />
        <Button
          label="Löschen"
          severity="danger"
          @click="confirmDelete && deleteMaintenance(confirmDelete.vehicleId, confirmDelete.type)"
        />
      </template>
    </Dialog>
  </main>
</template>

<style scoped>
.page-container {
  padding: 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

.page-title {
  margin: 0 0 1.5rem;
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--p-text-muted-color);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-text {
  margin-bottom: 1rem;
}

.vehicle-section {
  margin-bottom: 2rem;
}

.vehicle-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 500;
}

.vehicle-subtitle {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
  margin-bottom: 0.75rem;
}

.vehicle-progress {
  font-size: 0.75rem;
}

.schedule-hint {
  margin-bottom: 0.75rem;
}

.maintenance-list {
  border: 1px solid var(--p-surface-200);
  border-radius: 0.5rem;
  overflow: hidden;
}

.maintenance-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--p-surface-200);
}

.maintenance-item:last-child {
  border-bottom: none;
}

.maintenance-icon {
  flex-shrink: 0;
}

.maintenance-icon i {
  font-size: 1.25rem;
}

.maintenance-content {
  flex: 1;
  min-width: 0;
}

.maintenance-label {
  font-weight: 500;
}

.maintenance-caption {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

.maintenance-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}
</style>
