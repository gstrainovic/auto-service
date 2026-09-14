<script setup lang="ts">
import type { RateMap } from '../services/fx'
import type { DueResult } from '../services/maintenance-schedule'
import type { CurrencyOptions } from '../services/report'
import type { Maintenance } from '../stores/maintenances'
import Badge from 'primevue/badge'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import StatCard from '../components/StatCard.vue'
import { db, tx } from '../lib/instantdb'
import { formatCurrency, formatNumber, normalizeCurrency } from '../lib/locale'
import { resolveRates } from '../services/fx'
import { checkDueMaintenances, getMaintenanceSchedule } from '../services/maintenance-schedule'
import { buildFleetReport, fleetReportFilename } from '../services/pdf-report'
import { fleetCostsByVehicleYear, invoicesToCsvRows } from '../services/report'
import { useInvoicesStore } from '../stores/invoices'
import { useSettingsStore } from '../stores/settings'
import { useVehiclesStore } from '../stores/vehicles'

const router = useRouter()
const vehiclesStore = useVehiclesStore()
const invoicesStore = useInvoicesStore()
const dueMap = ref<Record<string, DueResult[]>>({})
const confirmDelete = ref<{ vehicleId: string, type: string, label: string } | null>(null)
onMounted(async () => {
  await vehiclesStore.load()
  await invoicesStore.load()
  await computeDue()
})

watch(() => vehiclesStore.vehicles, computeDue, { deep: true })

// Fuhrpark-Übersicht: Kosten pro Fahrzeug und Jahr in der Heimwährung, fremde Währungen zum EZB-Kurs am Rechnungsdatum
const settings = useSettingsStore()
const rates = ref<RateMap>(new Map())
watch(
  () => [invoicesStore.invoices, settings.homeCurrency] as const,
  async ([invoices, home]) => {
    rates.value = await resolveRates(invoices, home)
  },
  { immediate: true, deep: true },
)
const currencyOpts = computed<CurrencyOptions>(() => ({ homeCurrency: settings.homeCurrency, rates: rates.value }))
const fleetRows = computed(() => fleetCostsByVehicleYear(vehiclesStore.vehicles, invoicesStore.invoices, currencyOpts.value))
const foreignInvoices = computed(() => invoicesStore.invoices.filter(i => normalizeCurrency(i.currency) !== settings.homeCurrency))
const fleetConverted = computed(() => foreignInvoices.value.filter(i => rates.value.has(`${normalizeCurrency(i.currency)}|${settings.homeCurrency}|${i.date}`)).length)
const fleetUnconverted = computed(() => foreignInvoices.value.length - fleetConverted.value)
const foreignCurrencies = computed(() => [...new Set(foreignInvoices.value.map(i => normalizeCurrency(i.currency)))].join(', '))

function saveFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportFleetCsv(): void {
  const byId = new Map(vehiclesStore.vehicles.map(v => [v.id, v]))
  const entries = invoicesStore.invoices
    .filter(inv => byId.has(inv.vehicleId))
    .map(inv => ({ inv, vehicle: byId.get(inv.vehicleId)! }))
  const csv = invoicesToCsvRows(entries, currencyOpts.value)
  saveFile(new Blob([csv], { type: 'text/csv;charset=utf-8' }), fleetReportFilename().replace(/\.pdf$/, '.csv'))
}

async function exportFleetPdf(): Promise<void> {
  const result = await db.queryOnce({ maintenances: {} })
  const maintenances = (result?.data?.maintenances || []) as Maintenance[]
  const doc = buildFleetReport({ vehicles: vehiclesStore.vehicles, invoices: invoicesStore.invoices, maintenances, currency: currencyOpts.value })
  saveFile(doc.output('blob'), fleetReportFilename())
}

async function computeDue() {
  const result = await db.queryOnce({ maintenances: {} })
  const allMaintenances = result?.data?.maintenances || []

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
  const maintenances = (result?.data?.maintenances || [])
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

/** Summe pro Fahrzeug in der Heimwährung, gleiche Basis wie Tabelle und Kachel; ohne Kurs bleibt die Fremdwährung angehängt */
function getVehicleTotalCost(vehicleId: string): string {
  const totals: Record<string, number> = {}
  for (const row of fleetRows.value.filter(r => r.vehicleId === vehicleId))
    totals[row.currency] = Math.round(((totals[row.currency] || 0) + row.total) * 100) / 100
  const entries = Object.entries(totals).sort(([a], [b]) => (a === settings.homeCurrency ? -1 : b === settings.homeCurrency ? 1 : 0))
  return entries.map(([currency, amount]) => formatCurrency(amount, currency)).join(' + ')
}

function getVehicleInvoiceCount(vehicleId: string): number {
  return invoicesStore.getByVehicleId(vehicleId).length
}

// Gesamtkosten in der Heimwährung; Rechnungen ohne Kurs bleiben als eigene Währung stehen
const totalsByCurrency = computed(() => {
  const totals: Record<string, number> = {}
  for (const row of fleetRows.value)
    totals[row.currency] = Math.round(((totals[row.currency] || 0) + row.total) * 100) / 100
  return totals
})

const formattedTotalCost = computed(() => {
  const entries = Object.entries(totalsByCurrency.value)
  if (entries.length === 0)
    return formatCurrency(0, settings.homeCurrency)
  const home = entries.find(([c]) => c === settings.homeCurrency)
  const others = entries.filter(([c]) => c !== settings.homeCurrency)
  return [...(home ? [home] : []), ...others].map(([currency, amount]) => formatCurrency(amount, currency)).join(' + ')
})

const totalInvoiceCount = computed(() =>
  vehiclesStore.vehicles.reduce((sum, v) => sum + getVehicleInvoiceCount(v.id), 0),
)
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

    <div v-if="vehiclesStore.vehicles.length > 0" class="stats-grid">
      <StatCard
        icon="pi-wallet"
        label="Gesamtkosten"
        :value="formattedTotalCost"
      />
      <StatCard
        icon="pi-file"
        label="Rechnungen"
        :value="String(totalInvoiceCount)"
        color="var(--status-info)"
      />
    </div>

    <section v-if="fleetRows.length" class="fleet-costs">
      <div class="fleet-costs-header">
        <h3>Kosten pro Fahrzeug und Jahr</h3>
        <div class="fleet-costs-actions">
          <Button icon="pi pi-file-excel" label="CSV für Excel, alle Fahrzeuge" severity="secondary" outlined size="small" @click="exportFleetCsv" />
          <Button icon="pi pi-file-pdf" label="PDF-Übersicht, alle Fahrzeuge" severity="primary" size="small" @click="exportFleetPdf" />
        </div>
      </div>
      <div class="fleet-table-wrap">
        <table class="fleet-table" aria-label="Kosten pro Fahrzeug und Jahr">
          <thead>
            <tr>
              <th>Jahr</th>
              <th>Fahrzeug</th>
              <th class="num">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in fleetRows" :key="`${r.vehicleId}-${r.year}-${r.currency}`">
              <td>{{ r.year }}</td>
              <td>
                <router-link :to="`/vehicles/${r.vehicleId}`">
                  {{ r.vehicle }}
                </router-link>
              </td>
              <td class="num">
                {{ formatCurrency(r.total, r.currency) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="fleetConverted > 0 || fleetUnconverted > 0" class="fleet-hint">
        <template v-if="fleetConverted > 0">
          {{ fleetConverted }} {{ fleetConverted === 1 ? 'Rechnung' : 'Rechnungen' }} in {{ foreignCurrencies }} zum EZB-Kurs am Rechnungsdatum umgerechnet.
        </template>
        <template v-if="fleetUnconverted > 0">
          {{ fleetUnconverted }} ohne Kurs (offline?), in eigener Währung ausgewiesen.
        </template>
      </p>
    </section>

    <div v-for="vehicle in vehiclesStore.vehicles" :key="vehicle.id" class="vehicle-section">
      <h3 class="vehicle-title">
        {{ vehicle.make }} {{ vehicle.model }}
      </h3>
      <div class="vehicle-subtitle">
        {{ formatNumber(vehicle.mileage) }} km · {{ vehicle.licensePlate }}
        <span v-if="getVehicleInvoiceCount(vehicle.id) > 0" class="vehicle-cost">
          {{ getVehicleTotalCost(vehicle.id) }} · {{ getVehicleInvoiceCount(vehicle.id) }} Rechnungen
        </span>
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
              Zuletzt: {{ item.lastDoneAt }}<template v-if="item.lastMileage">
                bei {{ formatNumber(item.lastMileage) }} km
              </template>
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.vehicle-cost {
  color: var(--p-primary-color);
  font-weight: 500;
}

.vehicle-section {
  margin-bottom: 2rem;
}

.fleet-costs {
  margin-bottom: 2rem;
}

.fleet-costs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.fleet-costs-header h3 {
  margin: 0;
}

.fleet-costs-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.fleet-table-wrap {
  overflow-x: auto;
}

.fleet-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.fleet-table th,
.fleet-table td {
  padding: 0.45rem 0.6rem;
  border-bottom: 1px solid var(--p-surface-border);
  text-align: left;
  white-space: nowrap;
}

.fleet-table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.fleet-table a {
  color: inherit;
  text-decoration: none;
}

.fleet-table a:hover {
  text-decoration: underline;
}

.fleet-hint {
  margin: 0.5rem 0 0;
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
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
