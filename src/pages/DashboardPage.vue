<script setup lang="ts">
import type { RateMap } from '../services/fx'
import type { BatchEntry } from '../services/invoice-scan'
import type { DueResult, DueStatus } from '../services/maintenance-schedule'
import type { CurrencyOptions } from '../services/report'
import type { Maintenance } from '../stores/maintenances'
import type { Vehicle } from '../stores/vehicles'
import type { InvoiceFormData, MaintenanceFormData } from '../types/forms'
import Badge from 'primevue/badge'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Menu from 'primevue/menu'
import Message from 'primevue/message'
import Select from 'primevue/select'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import InvoiceFormDialog from '../components/InvoiceFormDialog.vue'
import LastServicesDialog from '../components/LastServicesDialog.vue'
import MaintenanceFormDialog from '../components/MaintenanceFormDialog.vue'
import MileageDialog from '../components/MileageDialog.vue'
import ServiceBookDialog from '../components/ServiceBookDialog.vue'
import StatCard from '../components/StatCard.vue'
import { db } from '../lib/instantdb'
import { formatCurrency, formatDate, formatNumber, normalizeCurrency } from '../lib/locale'
import { resolveRates } from '../services/fx'
import { formToInvoiceInput } from '../services/invoice-form'
import { saveInvoice } from '../services/invoice-save'
import { saveMaintenances } from '../services/maintenance-save'
import { checkDueMaintenances, dueDescription, fleetDueList, getMaintenanceSchedule, vehicleDueStatus } from '../services/maintenance-schedule'
import { buildFleetReport, fleetReportFilename } from '../services/pdf-report'
import { fleetCostsByVehicleYear, invoicesToCsvRows } from '../services/report'
import { activeVehicles } from '../services/vehicle-status'
import { invoiceYears, yearExportFilename, yearExportFiles } from '../services/year-export'
import { createZip } from '../services/zip'
import { useInvoicesStore } from '../stores/invoices'
import { useMaintenancesStore } from '../stores/maintenances'
import { useSettingsStore } from '../stores/settings'
import { useVehiclesStore } from '../stores/vehicles'

const router = useRouter()
const route = useRoute()
const vehiclesStore = useVehiclesStore()
const invoicesStore = useInvoicesStore()
const maintenancesStore = useMaintenancesStore()
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

// Verkaufte Fahrzeuge zeigen keine Fälligkeiten mehr, bleiben aber in Kosten und Exporten
const ownVehicles = computed(() => activeVehicles(vehiclesStore.vehicles))

// Fälligkeiten live aus dem Store: nach «Erledigt eintragen», einer Rechnung oder dem Chat sofort aktuell
const dueMap = computed<Record<string, DueResult[]>>(() => Object.fromEntries(ownVehicles.value.map(vehicle => [
  vehicle.id,
  checkDueMaintenances({
    currentMileage: vehicle.mileage,
    // Nur erledigte Arbeiten zählen als «zuletzt gemacht», geplante sind vereinbarte Termine
    lastMaintenances: maintenancesStore.maintenances
      .filter(m => m.vehicleId === vehicle.id && m.status === 'done')
      .map(m => ({ type: m.type, mileageAtService: m.mileageAtService, doneAt: m.doneAt, description: m.description })),
    plannedMaintenances: maintenancesStore.maintenances
      .filter(m => m.vehicleId === vehicle.id && m.status !== 'done')
      .map(m => ({ type: m.type, doneAt: m.doneAt })),
    schedule: getMaintenanceSchedule(vehicle.customSchedule as any),
  }),
])))

// Flottenblick: bald fällig und überfällig über alle Fahrzeuge
const fleetDue = computed(() => fleetDueList(ownVehicles.value, dueMap.value))
const vehiclesWithoutSchedule = computed(() => ownVehicles.value.filter(v => !v.customSchedule?.length))

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
// Kilometerstand schnell nachführen, ohne Umweg über «Bearbeiten»
const mileageFor = ref<Vehicle | null>(null)

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

// Beleg erfassen ohne Umweg über die Fahrzeugseite; bei mehreren Fahrzeugen zuerst die Wahl
const receiptFor = ref<Vehicle | null>(null)
const chooseVehicle = ref(false)

function startReceipt(): void {
  if (ownVehicles.value.length === 1)
    receiptFor.value = ownVehicles.value[0]!
  else
    chooseVehicle.value = true
}

function openReceiptFor(vehicle: Vehicle): void {
  chooseVehicle.value = false
  receiptFor.value = vehicle
}

async function saveReceipt(data: InvoiceFormData): Promise<void> {
  if (!receiptFor.value)
    return
  await saveInvoice(formToInvoiceInput(data, receiptFor.value.id))
  receiptFor.value = null
}

async function saveReceiptBatch(entries: BatchEntry[]): Promise<void> {
  if (!receiptFor.value)
    return
  for (const { draft, imageBase64, vehicleId } of entries) {
    if (!draft)
      continue
    await saveInvoice({
      ...draft,
      vehicleId: vehicleId ?? receiptFor.value.id,
      items: draft.items.map(i => ({ ...i })),
      ...(imageBase64 ? { imageData: imageBase64 } : {}),
    })
  }
  receiptFor.value = null
}

// Jahresabschluss als ZIP: CSV und Belegbilder eines Jahres
const years = computed(() => invoiceYears(invoicesStore.invoices))
const exportYear = ref<number>(new Date().getFullYear())
const exportNote = ref('')
watch(years, (list) => {
  if (list.length && !list.includes(exportYear.value))
    exportYear.value = list[0]!
}, { immediate: true })

function exportYearZip(): void {
  const files = yearExportFiles({ year: exportYear.value, vehicles: vehiclesStore.vehicles, invoices: invoicesStore.invoices, currency: currencyOpts.value })
  if (!files.length) {
    exportNote.value = `Keine Rechnungen aus ${exportYear.value}.`
    return
  }
  const images = files.length - 1
  saveFile(new Blob([createZip(files)], { type: 'application/zip' }), yearExportFilename(exportYear.value))
  exportNote.value = `CSV und ${images} ${images === 1 ? 'Beleg' : 'Belege'} geladen.`
}

// Exportmenü: CSV und PDF über alle Fahrzeuge, Jahresabschluss als ZIP fürs gewählte Jahr
const exportMenu = ref<InstanceType<typeof Menu> | null>(null)
const exportItems = computed(() => [
  { label: 'CSV für Excel, alle Fahrzeuge', icon: 'pi pi-file-excel', command: exportFleetCsv },
  { label: 'PDF-Übersicht, alle Fahrzeuge', icon: 'pi pi-file-pdf', command: exportFleetPdf },
  ...(years.value.length ? [{ label: `Jahresabschluss ${exportYear.value}: ZIP mit CSV und Belegen`, icon: 'pi pi-download', command: exportYearZip }] : []),
])

async function exportFleetPdf(): Promise<void> {
  const result = await db.queryOnce({ maintenances: {} })
  const maintenances = (result?.data?.maintenances || []) as Maintenance[]
  const doc = buildFleetReport({ vehicles: vehiclesStore.vehicles, invoices: invoicesStore.invoices, maintenances, currency: currencyOpts.value })
  saveFile(doc.output('blob'), fleetReportFilename())
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
    <div class="page-header">
      <h2 class="page-title">
        Übersicht
      </h2>
      <Button
        v-if="ownVehicles.length > 0"
        icon="pi pi-camera"
        label="Beleg erfassen"
        @click="startReceipt"
      />
    </div>

    <div v-if="vehiclesStore.vehicles.length === 0" class="empty-state">
      <i class="pi pi-car empty-icon" />
      <div class="empty-text">
        Leg dein erstes Fahrzeug an. Mit dem Fahrzeugausweis geht es am schnellsten.
      </div>
      <div class="empty-actions">
        <Button
          label="Fahrzeug hinzufügen"
          icon="pi pi-plus"
          @click="router.push('/vehicles?action=add')"
        />
      </div>
      <p class="empty-hint">
        Danach fotografierst du die erste Werkstattrechnung, den Rest liest Wartungsheft heraus.
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
    <section v-if="ownVehicles.length > 0" class="fleet-due" aria-label="Fällige Arbeiten">
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
            {{ vehiclesWithoutSchedule.length === ownVehicles.length ? (ownVehicles.length === 1 ? 'Dein Fahrzeug nutzt' : 'Alle Fahrzeuge nutzen') : `${vehiclesWithoutSchedule.length} ${vehiclesWithoutSchedule.length === 1 ? 'Fahrzeug nutzt' : 'Fahrzeuge nutzen'}` }}
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
        <!-- Alle Exporte hinter einem Knopf, damit die Zeile am Handy nicht zerfällt -->
        <div class="fleet-costs-actions">
          <Select v-if="years.length" id="export-year" v-model="exportYear" :options="years" size="small" aria-label="Jahr für den Jahresabschluss" />
          <Button icon="pi pi-download" label="Export" size="small" aria-haspopup="true" aria-controls="export-menu" @click="exportMenu?.toggle($event)" />
          <Menu id="export-menu" ref="exportMenu" :model="exportItems" popup />
        </div>
      </div>
      <small v-if="exportNote" role="status" class="fleet-hint">{{ exportNote }}</small>
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

    <div v-for="vehicle in ownVehicles" :id="`fahrzeug-${vehicle.id}`" :key="vehicle.id" class="vehicle-section">
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
          :value="getDueCounts(vehicle.id).due ? `${getDueCounts(vehicle.id).due} fällig` : 'OK'"
          :severity="getDueCounts(vehicle.id).due > 0 ? 'warn' : 'success'"
        />
      </div>
      <p class="vehicle-subtitle">
        {{ formatNumber(vehicle.mileage) }} km
        <Button
          v-tooltip.top="'Kilometerstand ändern'"
          icon="pi pi-pencil"
          text
          rounded
          size="small"
          severity="secondary"
          class="mileage-edit"
          :aria-label="`Kilometerstand ${vehicle.make} ${vehicle.model} ändern`"
          @click="mileageFor = vehicle"
        /><template v-if="vehicle.licensePlate">
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
        <div v-for="item in visibleItems(vehicle.id)" :key="item.key" class="maintenance-item">
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

    <MileageDialog :vehicle="mileageFor" @close="mileageFor = null" />

    <!-- Beleg erfassen: bei mehreren Fahrzeugen zuerst fragen, für welches -->
    <Dialog
      :visible="chooseVehicle"
      modal
      header="Für welches Fahrzeug?"
      data-testid="choose-vehicle-dialog"
      :style="{ width: 'min(420px, 94vw)' }"
      @update:visible="chooseVehicle = false"
    >
      <div class="vehicle-choice">
        <Button
          v-for="v in ownVehicles"
          :key="v.id"
          :label="`${v.make} ${v.model}${v.licensePlate ? ` · ${v.licensePlate}` : ''}`"
          icon="pi pi-car"
          severity="secondary"
          outlined
          @click="openReceiptFor(v)"
        />
      </div>
    </Dialog>

    <InvoiceFormDialog
      :visible="!!receiptFor"
      title="Neue Rechnung"
      :existing-invoices="invoicesStore.invoices"
      :vehicles="vehiclesStore.vehicles"
      :vehicle-id="receiptFor?.id"
      @update:visible="v => { if (!v) receiptFor = null }"
      @submit="saveReceipt"
      @submit-batch="saveReceiptBatch"
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

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.vehicle-choice {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.year-export {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin: 0.75rem 0;
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
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

.mileage-edit {
  width: 1.75rem;
  height: 1.75rem;
  vertical-align: -0.4rem;
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
