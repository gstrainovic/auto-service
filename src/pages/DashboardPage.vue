<script setup lang="ts">
import type { RateMap } from '../services/fx'
import type { DueResult, DueStatus } from '../services/maintenance-schedule'
import type { CurrencyOptions } from '../services/report'
import type { Maintenance } from '../stores/maintenances'
import type { Vehicle } from '../stores/vehicles'
import type { MaintenanceFormData } from '../types/forms'
import Badge from 'primevue/badge'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LastServicesDialog from '../components/LastServicesDialog.vue'
import MaintenanceFormDialog from '../components/MaintenanceFormDialog.vue'
import ServiceBookDialog from '../components/ServiceBookDialog.vue'
import StatCard from '../components/StatCard.vue'
import { db, tx } from '../lib/instantdb'
import { formatCurrency, formatDate, formatNumber, normalizeCurrency } from '../lib/locale'
import { resolveRates } from '../services/fx'
import { saveMaintenances } from '../services/maintenance-save'
import { checkDueMaintenances, dueDescription, fleetDueList, getMaintenanceSchedule, vehicleDueStatus } from '../services/maintenance-schedule'
import { buildFleetReport, fleetReportFilename } from '../services/pdf-report'
import { fleetCostsByVehicleYear, invoicesToCsvRows } from '../services/report'
import { useInvoicesStore } from '../stores/invoices'
import { useMaintenancesStore } from '../stores/maintenances'
import { useSettingsStore } from '../stores/settings'
import { useVehiclesStore } from '../stores/vehicles'

const router = useRouter()
const route = useRoute()
const vehiclesStore = useVehiclesStore()
const invoicesStore = useInvoicesStore()
const maintenancesStore = useMaintenancesStore()
const confirmDelete = ref<{ vehicleId: string, type: string, label: string } | null>(null)
onMounted(async () => {
  await vehiclesStore.load()
  await invoicesStore.load()
  maintenancesStore.load()
  // Link aus der Erinnerungs-Mail: /dashboard#fahrzeug-<id> springt zum Fahrzeug
  if (route.hash.startsWith('#fahrzeug-')) {
    await nextTick()
    setTimeout(() => document.getElementById(route.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
  }
})

// Fälligkeiten live aus dem Store: nach «Erledigt eintragen», einer Rechnung oder dem Chat sofort aktuell
const dueMap = computed<Record<string, DueResult[]>>(() => Object.fromEntries(vehiclesStore.vehicles.map(vehicle => [
  vehicle.id,
  checkDueMaintenances({
    currentMileage: vehicle.mileage,
    // Nur erledigte Arbeiten zählen als «zuletzt gemacht», geplante Einträge nicht
    lastMaintenances: maintenancesStore.maintenances
      .filter(m => m.vehicleId === vehicle.id && m.status === 'done')
      .map(m => ({ type: m.type, mileageAtService: m.mileageAtService, doneAt: m.doneAt })),
    schedule: getMaintenanceSchedule(vehicle.customSchedule as any),
  }),
])))

// Flottenblick: bald fällig und überfällig über alle Fahrzeuge
const fleetDue = computed(() => fleetDueList(vehiclesStore.vehicles, dueMap.value))
const vehiclesWithoutSchedule = computed(() => vehiclesStore.vehicles.filter(v => !v.customSchedule?.length))

// Intervalle ohne jeden Eintrag je Fahrzeug zugeklappt
const expandedUnknown = ref<Set<string>>(new Set())
function toggleUnknown(vehicleId: string): void {
  const next = new Set(expandedUnknown.value)
  if (next.has(vehicleId))
    next.delete(vehicleId)
  else
    next.add(vehicleId)
  expandedUnknown.value = next
}
function visibleItems(vehicleId: string): DueResult[] {
  const items = dueMap.value[vehicleId] ?? []
  return expandedUnknown.value.has(vehicleId) ? items : items.filter(i => i.status !== 'unknown')
}
function unknownCount(vehicleId: string): number {
  return (dueMap.value[vehicleId] ?? []).filter(i => i.status === 'unknown').length
}

// «Erledigt eintragen»: Wartungsformular mit Fahrzeug und Arbeit vorbefüllt
const doneFor = ref<{ vehicleId: string, title: string, initial: Partial<MaintenanceFormData> } | null>(null)
function openDone(vehicleId: string, item: DueResult): void {
  const vehicle = vehiclesStore.vehicles.find(v => v.id === vehicleId)
  doneFor.value = {
    vehicleId,
    title: `${item.label} erledigt${vehicle ? ` · ${vehicle.make} ${vehicle.model}` : ''}`,
    initial: {
      category: item.type as MaintenanceFormData['category'],
      date: new Date().toISOString().slice(0, 10),
      mileage: vehicle?.mileage || undefined,
      status: 'done',
    },
  }
}
async function saveDone(data: MaintenanceFormData): Promise<void> {
  if (!doneFor.value)
    return
  await saveMaintenances([{
    vehicleId: doneFor.value.vehicleId,
    type: data.category,
    description: data.description,
    doneAt: data.date,
    mileageAtService: data.mileage,
    status: data.status === 'planned' ? 'due' : 'done',
  }])
  doneFor.value = null
}

// Fahrzeug ohne jeden Eintrag: letzte Wartungen nachtragen
const lastServicesFor = ref<{ id: string, name: string } | null>(null)
const serviceBookFor = ref<Vehicle | null>(null)

function scrollToVehicle(vehicleId: string): void {
  document.getElementById(`fahrzeug-${vehicleId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

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

async function deleteMaintenance(vehicleId: string, type: string) {
  const maintenances = maintenancesStore.maintenances.filter(m => m.vehicleId === vehicleId && m.type === type)
  if (maintenances.length)
    await db.transact(maintenances.map(m => tx.maintenances[m.id].delete()))
  confirmDelete.value = null
}

function getStatusIcon(status: DueStatus): string {
  if (status === 'overdue')
    return 'pi pi-exclamation-triangle'
  if (status === 'due')
    return 'pi pi-clock'
  if (status === 'unknown')
    return 'pi pi-question-circle'
  return 'pi pi-check-circle'
}

function getStatusColor(status: DueStatus): string {
  if (status === 'overdue')
    return 'var(--p-red-500)'
  if (status === 'due')
    return 'var(--p-yellow-500)'
  if (status === 'unknown')
    return 'var(--p-text-muted-color)'
  return 'var(--p-green-500)'
}

function getStatusSeverity(status: DueStatus): 'danger' | 'warn' | 'success' | 'secondary' {
  if (status === 'overdue')
    return 'danger'
  if (status === 'due')
    return 'warn'
  if (status === 'unknown')
    return 'secondary'
  return 'success'
}

function getStatusLabel(status: DueStatus): string {
  if (status === 'overdue')
    return 'Überfällig'
  if (status === 'due')
    return 'Bald fällig'
  if (status === 'unknown')
    return 'Kein Eintrag'
  return 'OK'
}

/** Zähler im Badge: fällige und überfällige Arbeiten gegenüber allen Intervallen (ohne erledigte Arbeiten ausserhalb des Plans) */
function getDueCounts(vehicleId: string): { due: number, total: number } {
  const items = dueMap.value[vehicleId] || []
  const due = items.filter(i => i.status === 'due' || i.status === 'overdue').length
  const total = items.filter(i => i.status === 'unknown' || i.nextDueDate !== undefined).length
  return { due, total }
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
      <div class="empty-actions">
        <Button
          label="Fahrzeug hinzufügen"
          icon="pi pi-plus"
          @click="router.push('/vehicles?action=add')"
        />
        <Button
          label="Rechnung im Chat fotografieren"
          icon="pi pi-camera"
          severity="secondary"
          outlined
          @click="router.push('/dashboard?chat=open')"
        />
      </div>
      <p class="empty-hint">
        Oder du fotografierst im Chat (Button unten rechts) eine Werkstattrechnung, die KI legt Fahrzeug und Rechnung an.
      </p>
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

    <!-- Flottenblick: was über alle Fahrzeuge bald fällig oder überfällig ist, dringendstes zuerst -->
    <section v-if="vehiclesStore.vehicles.length > 0" class="fleet-due" aria-label="Fällige Arbeiten">
      <h3>Fällig</h3>
      <p v-if="!fleetDue.length" class="fleet-due-empty">
        <i class="pi pi-check-circle" /> Nichts überfällig und nichts in den nächsten 30 Tagen oder 1'000 km fällig.
      </p>
      <div v-else class="maintenance-list">
        <div v-for="entry in fleetDue" :key="`${entry.vehicleId}-${entry.item.type}`" class="maintenance-item fleet-due-item">
          <div class="maintenance-icon">
            <i :class="getStatusIcon(entry.item.status)" :style="{ color: getStatusColor(entry.item.status) }" />
          </div>
          <div class="maintenance-content">
            <div class="maintenance-label">
              {{ entry.item.label }}
              <router-link :to="`/dashboard#fahrzeug-${entry.vehicleId}`" class="fleet-due-vehicle" @click.prevent="scrollToVehicle(entry.vehicleId)">
                {{ entry.vehicleName }}
              </router-link>
            </div>
            <div class="maintenance-caption">
              {{ dueDescription(entry.item) }}
            </div>
          </div>
          <div class="maintenance-actions">
            <Badge :value="getStatusLabel(entry.item.status)" :severity="getStatusSeverity(entry.item.status)" />
            <Button label="Erledigt eintragen" icon="pi pi-check" size="small" outlined @click="openDone(entry.vehicleId, entry.item)" />
          </div>
        </div>
      </div>
      <Message v-if="vehiclesWithoutSchedule.length" severity="secondary" :closable="false" class="schedule-hint">
        <template #icon>
          <i class="pi pi-info-circle" />
        </template>
        <div class="schedule-hint-body">
          <span>
            {{ vehiclesWithoutSchedule.length === vehiclesStore.vehicles.length ? (vehiclesStore.vehicles.length === 1 ? 'Dein Fahrzeug nutzt' : 'Alle Fahrzeuge nutzen') : `${vehiclesWithoutSchedule.length} ${vehiclesWithoutSchedule.length === 1 ? 'Fahrzeug nutzt' : 'Fahrzeuge nutzen'}` }}
            allgemeine Wartungsintervalle. Mit dem Serviceheft werden sie genau:
          </span>
          <span class="schedule-hint-actions">
            <Button
              v-for="v in vehiclesWithoutSchedule"
              :key="v.id"
              :label="`${v.make} ${v.model}`"
              :aria-label="`Serviceheft ${v.make} ${v.model}`"
              icon="pi pi-book"
              size="small"
              outlined
              @click="serviceBookFor = v"
            />
          </span>
        </div>
      </Message>
    </section>

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

    <div v-for="vehicle in vehiclesStore.vehicles" :id="`fahrzeug-${vehicle.id}`" :key="vehicle.id" class="vehicle-section">
      <div class="vehicle-header">
        <h3 class="vehicle-title">
          <router-link :to="`/vehicles/${vehicle.id}`">
            {{ vehicle.make }} {{ vehicle.model }}
          </router-link>
        </h3>
        <Badge
          v-if="vehicleDueStatus(dueMap[vehicle.id] ?? []) === 'unknown'"
          class="vehicle-progress"
          value="Noch keine Wartung erfasst"
          severity="secondary"
        />
        <Badge
          v-else-if="getDueCounts(vehicle.id).total > 0"
          class="vehicle-progress"
          :value="`${getDueCounts(vehicle.id).due}/${getDueCounts(vehicle.id).total} fällig`"
          :severity="getDueCounts(vehicle.id).due > 0 ? 'warn' : 'success'"
        />
      </div>
      <p class="vehicle-subtitle">
        {{ formatNumber(vehicle.mileage) }} km<template v-if="vehicle.licensePlate">
          · {{ vehicle.licensePlate }}
        </template><template v-if="getVehicleInvoiceCount(vehicle.id) > 0">
          · <span class="vehicle-cost">{{ getVehicleTotalCost(vehicle.id) }} · {{ getVehicleInvoiceCount(vehicle.id) }} {{ getVehicleInvoiceCount(vehicle.id) === 1 ? 'Rechnung' : 'Rechnungen' }}</span>
        </template>
      </p>

      <div v-if="vehicleDueStatus(dueMap[vehicle.id] ?? []) === 'unknown'" class="no-history">
        <span>Ohne erfasste Wartungen kennt Wartungsheft keine Termine und schickt keine Erinnerung.</span>
        <Button
          label="Letzte Wartungen nachtragen"
          icon="pi pi-history"
          size="small"
          @click="lastServicesFor = { id: vehicle.id, name: `${vehicle.make} ${vehicle.model}` }"
        />
      </div>

      <div v-if="visibleItems(vehicle.id).length" class="maintenance-list">
        <div v-for="item in visibleItems(vehicle.id)" :key="item.type" class="maintenance-item">
          <div class="maintenance-icon">
            <i :class="getStatusIcon(item.status)" :style="{ color: getStatusColor(item.status) }" />
          </div>
          <div class="maintenance-content">
            <div class="maintenance-label">
              {{ item.label }}
            </div>
            <div v-if="item.lastDoneAt" class="maintenance-caption">
              Zuletzt: {{ formatDate(item.lastDoneAt) }}<template v-if="item.lastMileage">
                bei {{ formatNumber(item.lastMileage) }} km
              </template><template v-if="item.nextDueDate || item.nextDueMileage">
                · {{ dueDescription(item) }}
              </template>
            </div>
          </div>
          <div class="maintenance-actions">
            <Badge
              :value="getStatusLabel(item.status)"
              :severity="getStatusSeverity(item.status)"
            />
            <Button
              v-if="item.status !== 'done' || item.nextDueDate"
              v-tooltip.left="'Erledigt eintragen'"
              icon="pi pi-check"
              text
              rounded
              size="small"
              severity="secondary"
              :aria-label="`${item.label} erledigt eintragen`"
              @click="openDone(vehicle.id, item)"
            />
            <Button
              v-if="item.lastDoneAt"
              icon="pi pi-trash"
              text
              rounded
              size="small"
              severity="secondary"
              :aria-label="`${item.label} Einträge löschen`"
              @click="confirmDelete = { vehicleId: vehicle.id, type: item.type, label: item.label }"
            />
          </div>
        </div>
      </div>
      <Button
        v-if="unknownCount(vehicle.id) && vehicleDueStatus(dueMap[vehicle.id] ?? []) !== 'unknown'"
        :label="expandedUnknown.has(vehicle.id) ? 'Arbeiten ohne Eintrag ausblenden' : `${unknownCount(vehicle.id)} ${unknownCount(vehicle.id) === 1 ? 'Arbeit' : 'Arbeiten'} ohne Eintrag anzeigen`"
        :icon="expandedUnknown.has(vehicle.id) ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
        text
        size="small"
        severity="secondary"
        class="unknown-toggle"
        @click="toggleUnknown(vehicle.id)"
      />
    </div>

    <MaintenanceFormDialog
      :visible="!!doneFor"
      :title="doneFor?.title"
      :initial-data="doneFor?.initial"
      @update:visible="v => { if (!v) doneFor = null }"
      @submit="saveDone"
    />

    <ServiceBookDialog
      :visible="!!serviceBookFor"
      :vehicle="serviceBookFor"
      @update:visible="v => { if (!v) serviceBookFor = null }"
    />

    <LastServicesDialog
      :visible="!!lastServicesFor"
      :vehicle-id="lastServicesFor?.id ?? null"
      :vehicle-name="lastServicesFor?.name"
      @update:visible="v => { if (!v) lastServicesFor = null }"
    />

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

.empty-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.empty-hint {
  margin: 1rem auto 0;
  max-width: 32rem;
  font-size: 0.875rem;
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

/* Jahr und Total bleiben einzeilig, der Fahrzeugname darf umbrechen, damit die Tabelle auf 390 px passt */
.fleet-table th,
.fleet-table td {
  padding: 0.45rem 0.6rem;
  border-bottom: 1px solid var(--p-surface-border);
  text-align: left;
}

.fleet-table th:first-child,
.fleet-table td:first-child {
  width: 1%;
  white-space: nowrap;
}

.fleet-table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
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

/* Zwei Zeilen: Titel mit Badge, darunter km · Schild · Kosten als Fliesstext */
.vehicle-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.vehicle-title {
  margin: 0;
  min-width: 0;
  font-size: 1.25rem;
  font-weight: 500;
}

.vehicle-subtitle {
  margin: 0.25rem 0 0.75rem;
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}

.vehicle-progress {
  flex-shrink: 0;
  white-space: nowrap;
  font-size: 0.75rem;
}

.schedule-hint {
  margin-bottom: 0.75rem;
}

.vehicle-title a {
  color: inherit;
  text-decoration: none;
}

.vehicle-title a:hover {
  text-decoration: underline;
}

.fleet-due {
  margin-bottom: 2rem;
}

.fleet-due h3 {
  margin: 0 0 0.5rem;
}

.fleet-due .schedule-hint {
  margin: 0.75rem 0 0;
}

.schedule-hint-body {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
}

.schedule-hint-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.fleet-due-empty {
  margin: 0;
  color: var(--p-text-muted-color);
}

.fleet-due-empty i {
  color: var(--p-green-500);
  margin-right: 0.35rem;
}

.fleet-due-vehicle {
  margin-left: 0.35rem;
  font-weight: 400;
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}

.no-history {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  padding: 0.75rem 1rem;
  margin-bottom: 0.75rem;
  border: 1px dashed var(--p-surface-300);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}

.unknown-toggle {
  margin-top: 0.25rem;
}

@media (max-width: 520px) {
  .maintenance-item {
    flex-wrap: wrap;
  }

  .fleet-due-item .maintenance-actions {
    width: 100%;
    justify-content: flex-end;
  }
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
