<script setup lang="ts">
import type { Vehicle } from '../stores/vehicles'
import Badge from 'primevue/badge'
import Card from 'primevue/card'
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { formatCurrency, formatNumber } from '../lib/locale'
import { checkDueMaintenances, getMaintenanceSchedule, vehicleDueStatus } from '../services/maintenance-schedule'
import { fleetCostsByVehicleYear } from '../services/report'
import { soldLabel } from '../services/vehicle-status'
import { useInvoicesStore } from '../stores/invoices'
import { useMaintenancesStore } from '../stores/maintenances'
import { useSettingsStore } from '../stores/settings'

const props = defineProps<{ vehicle: Vehicle }>()
const router = useRouter()

// Fälligkeit live aus dem Store (nach «Erledigt eintragen» oder einer Rechnung sofort aktuell)
const maintenancesStore = useMaintenancesStore()
const settings = useSettingsStore()
onMounted(() => maintenancesStore.load())

const dueItems = computed(() => checkDueMaintenances({
  currentMileage: props.vehicle.mileage,
  // Nur erledigte Einträge zählen als Wartung, geplante sind vereinbarte Termine
  lastMaintenances: maintenancesStore.maintenances
    .filter(m => m.vehicleId === props.vehicle.id && m.status === 'done')
    .map(m => ({ type: m.type, mileageAtService: m.mileageAtService, doneAt: m.doneAt, description: m.description })),
  plannedMaintenances: maintenancesStore.maintenances
    .filter(m => m.vehicleId === props.vehicle.id && m.status !== 'done')
    .map(m => ({ type: m.type, doneAt: m.doneAt })),
  schedule: getMaintenanceSchedule(props.vehicle.customSchedule as any),
}))
// Verkauft: keine Fälligkeit mehr, nur noch der Vermerk
const sold = computed(() => soldLabel(props.vehicle))
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

// Kosten des laufenden Jahres, damit die Karte etwas sagt statt leer zu bleiben
const invoicesStore = useInvoicesStore()
onMounted(() => invoicesStore.load())
const currentYear = new Date().getFullYear()
const yearCost = computed(() => {
  const invoices = invoicesStore.invoices.filter(i => i.vehicleId === props.vehicle.id && i.date?.startsWith(String(currentYear)))
  if (!invoices.length)
    return ''
  const rows = fleetCostsByVehicleYear([props.vehicle], invoices, { homeCurrency: settings.homeCurrency, rates: new Map() })
  return rows
    .filter(r => r.year === currentYear)
    .map(r => formatCurrency(r.total, r.currency))
    .join(' + ')
})

// Löschen nur auf der Fahrzeugseite: ein Papierkorb neben dem Öffnen-Pfeil war auf dem Handy ein Fehlklick-Risiko
function navigateToDetail(): void {
  router.push(`/vehicles/${props.vehicle.id}`)
}
</script>

<template>
  <Card class="vehicle-card" @click="navigateToDetail">
    <template #title>
      <div class="title-row">
        <span>{{ vehicle.make }} {{ vehicle.model }}</span>
        <Badge v-if="sold" :value="sold" severity="secondary" />
        <Badge v-else :value="statusLabel" :severity="statusSeverity" />
      </div>
    </template>
    <template #subtitle>
      <div class="subtitle-row">
        <span v-if="vehicle.year">{{ vehicle.year }}</span>
        <Badge v-if="vehicle.licensePlate" :value="vehicle.licensePlate" severity="secondary" class="license-badge" />
      </div>
    </template>
    <template #content>
      <!-- Eine Zeile statt Leerfläche: km, Kosten des laufenden Jahres und Chevron als Klick-Hinweis -->
      <div class="card-row">
        <span v-if="vehicle.mileage" class="mileage">
          <i class="pi pi-gauge" />
          {{ formatNumber(vehicle.mileage) }} km
        </span>
        <span v-if="yearCost" class="year-cost">
          <i class="pi pi-wallet" />
          {{ yearCost }} in {{ currentYear }}
        </span>
        <span class="card-spacer" />
        <i class="pi pi-chevron-right chevron" />
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

.card-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--p-text-muted-color);
  font-size: 0.875rem;
}

.mileage,
.year-cost {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.card-spacer {
  flex: 1;
}

.chevron {
  color: var(--p-text-muted-color);
}

/* Am Handy hat «Ölwechsel überfällig» neben dem Fahrzeugnamen keinen Platz: Badge darf umbrechen und mehrzeilig werden */
.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.35rem 0.5rem;
}

.title-row > span {
  min-width: 0;
}

.title-row :deep(.p-badge) {
  max-width: 100%;
  height: auto;
  line-height: 1.25;
  padding: 0.15rem 0.5rem;
  white-space: normal;
  text-align: right;
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
