<script setup lang="ts">
/**
 * Serviceheft ohne Chat: Seiten fotografieren oder PDF wählen, Hersteller-Intervalle und Stempel prüfen, speichern.
 * Die Intervalle lassen sich auch ohne Scan von Hand anpassen (Tabelle startet mit dem aktuellen Plan).
 */
import type { MaintenanceCategory } from '../services/categories'
import type { BookEntry, ScheduleRow } from '../services/service-book'
import type { Vehicle } from '../stores/vehicles'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed, ref, watch } from 'vue'
import { useServiceBookScan } from '../composables/useServiceBookScan'
import { formatDate, formatNumber, LOCALE } from '../lib/locale'
import { MAINTENANCE_CATEGORIES } from '../services/categories'
import { saveMaintenances } from '../services/maintenance-save'
import { categoryLabel } from '../services/report'
import { mergeIntervals, rowsToSchedule, scheduleRows, serviceBookEntries } from '../services/service-book'
import { useMaintenancesStore } from '../stores/maintenances'
import { useVehiclesStore } from '../stores/vehicles'

const props = defineProps<{
  visible: boolean
  vehicle: Vehicle | null
}>()

const emit = defineEmits<{ 'update:visible': [value: boolean], 'saved': [] }>()

const vehiclesStore = useVehiclesStore()
const maintenancesStore = useMaintenancesStore()
const scan = useServiceBookScan()

const rows = ref<ScheduleRow[]>([])
const entries = ref<BookEntry[]>([])
const scanSummary = ref('')
const newType = ref<MaintenanceCategory | null>(null)
const saving = ref(false)

const categoryOptions = MAINTENANCE_CATEGORIES.map(c => ({ value: c, label: categoryLabel(c) }))
const selectedEntries = computed(() => entries.value.filter(e => e.selected))

watch(() => props.visible, (v) => {
  if (!v)
    return
  rows.value = scheduleRows(props.vehicle?.customSchedule as ScheduleRow[] | undefined)
  entries.value = []
  scanSummary.value = ''
  scan.progress.value = ''
  scan.failed.value = false
  newType.value = null
}, { immediate: true })

async function onFiles(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  if (!files.length || !props.vehicle)
    return
  scanSummary.value = ''
  const result = await scan.handleFiles(files)
  const merged = mergeIntervals(rows.value, result.intervals)
  rows.value = merged.rows
  const existing = maintenancesStore.maintenances.filter(m => m.vehicleId === props.vehicle!.id)
  const found = serviceBookEntries(result.pages, existing)
  // weitere Seiten ergänzen die Liste, gleiche Einträge nicht doppelt
  const known = new Set(entries.value.map(e => e.key))
  entries.value = [...entries.value, ...found.filter(e => !known.has(e.key))]
  const parts = [
    merged.changed ? `${merged.changed} ${merged.changed === 1 ? 'Intervall' : 'Intervalle'} übernommen` : 'keine Hersteller-Intervalle gefunden',
    ...(merged.ignored ? [`${merged.ignored} aus einer Checkliste verworfen`] : []),
    found.length ? `${found.length} ${found.length === 1 ? 'Eintrag' : 'Einträge'} gefunden` : 'keine Stempel gefunden',
  ]
  const duplicates = found.filter(e => e.duplicate).length
  if (duplicates)
    parts.push(`${duplicates} schon erfasst`)
  const doubtful = found.filter(e => e.doubtful).length
  if (doubtful)
    parts.push(`${doubtful} mit unklarem Kilometerstand`)
  scanSummary.value = `${parts.join(', ')}. Bitte prüfen.`
}

function addRow(): void {
  if (!newType.value)
    return
  rows.value = [...rows.value, ...mergeIntervals([], [{ type: newType.value, intervalKm: 0, intervalMonths: 12 }]).rows]
  newType.value = null
}

function removeRow(key: string): void {
  rows.value = rows.value.filter(r => r.key !== key)
}

async function save(): Promise<void> {
  if (!props.vehicle)
    return
  saving.value = true
  try {
    await vehiclesStore.updateCustomSchedule(props.vehicle.id, rowsToSchedule(rows.value))
    await saveMaintenances(selectedEntries.value.map(e => ({
      vehicleId: props.vehicle!.id,
      type: e.type,
      description: [e.workshop, e.description].filter(Boolean).join(': '),
      doneAt: e.doneAt,
      mileageAtService: e.mileage,
      status: 'done' as const,
    })))
    emit('saved')
    emit('update:visible', false)
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    header="Serviceheft"
    data-testid="service-book-dialog"
    :style="{ width: 'min(720px, 96vw)' }"
    @update:visible="emit('update:visible', $event)"
  >
    <section class="book-scan">
      <label class="upload-label" :class="{ disabled: scan.scanning.value }">
        <i :class="scan.scanning.value ? 'pi pi-spin pi-spinner' : 'pi pi-camera'" />
        <span>Serviceheft-Seiten fotografieren oder PDF wählen</span>
        <input
          type="file"
          accept="image/*,application/pdf"
          multiple
          class="visually-hidden"
          :disabled="scan.scanning.value"
          @change="onFiles"
        >
      </label>
      <small v-if="scan.scanning.value" class="scan-status" role="status">{{ scan.progress.value }}</small>
      <small v-else-if="scan.failed.value" class="scan-status error" role="status">{{ scan.progress.value }} {{ scanSummary }}</small>
      <small v-else-if="scanSummary" class="scan-status" role="status">{{ scanSummary }}</small>
      <small v-else class="scan-status">Seite mit den Wartungsintervallen und Seiten mit Stempeln. Du kannst die Werte danach anpassen.</small>
    </section>

    <section>
      <h4>Wartungsintervalle</h4>
      <p class="hint">
        Was zuerst eintritt, Kilometer oder Monate. 0 heisst: gilt nicht. Zeilen ohne beides werden nicht gespeichert.
      </p>
      <div class="interval-rows" role="table" aria-label="Wartungsintervalle">
        <div class="interval-row interval-head" role="row">
          <span role="columnheader">Arbeit</span>
          <span role="columnheader">Kilometer</span>
          <span role="columnheader">Monate</span>
          <span />
        </div>
        <div v-for="row in rows" :key="row.key" class="interval-row" role="row" :data-type="row.type">
          <InputText v-model="row.label" :aria-label="`Bezeichnung ${categoryLabel(row.type)}`" />
          <InputNumber v-model="row.intervalKm" :locale="LOCALE" :min="0" suffix=" km" :aria-label="`${row.label} Intervall Kilometer`" />
          <InputNumber v-model="row.intervalMonths" :min="0" :max="240" suffix=" Mt." :aria-label="`${row.label} Intervall Monate`" />
          <Button icon="pi pi-times" text rounded severity="secondary" :aria-label="`${row.label} entfernen`" @click="removeRow(row.key)" />
        </div>
      </div>
      <div class="add-row">
        <Select v-model="newType" :options="categoryOptions" option-label="label" option-value="value" placeholder="Weitere Arbeit" aria-label="Weitere Arbeit" />
        <Button label="Hinzufügen" icon="pi pi-plus" text :disabled="!newType" @click="addRow" />
      </div>
    </section>

    <section v-if="entries.length">
      <h4>Stempel aus dem Serviceheft</h4>
      <p class="hint">
        Angekreuzte Einträge werden als erledigte Wartungen gespeichert. Handschrift liest die KI nicht immer richtig,
        darum vor dem Speichern Datum und Kilometer vergleichen.
      </p>
      <div class="book-entries">
        <label v-for="entry in entries" :key="entry.key" class="book-entry" :class="{ duplicate: entry.duplicate || entry.doubtful }">
          <Checkbox v-model="entry.selected" binary :aria-label="`${categoryLabel(entry.type)} ${formatDate(entry.doneAt)} übernehmen`" />
          <span class="entry-main">
            <strong>{{ categoryLabel(entry.type) }}</strong> · {{ formatDate(entry.doneAt) }}<template v-if="entry.mileage"> · {{ formatNumber(entry.mileage) }} km</template>
            <small v-if="entry.description || entry.workshop">{{ [entry.workshop, entry.description].filter(Boolean).join(': ') }}</small>
          </span>
          <small v-if="entry.duplicate" class="duplicate-note">schon erfasst</small>
          <small v-else-if="entry.doubtful" class="duplicate-note">km prüfen</small>
        </label>
      </div>
    </section>

    <template #footer>
      <Button label="Abbrechen" text severity="secondary" @click="emit('update:visible', false)" />
      <Button
        :label="selectedEntries.length ? `Plan und ${selectedEntries.length} ${selectedEntries.length === 1 ? 'Eintrag' : 'Einträge'} speichern` : 'Plan speichern'"
        :loading="saving"
        :disabled="scan.scanning.value"
        @click="save"
      />
    </template>
  </Dialog>
</template>

<style scoped>
section + section {
  margin-top: 1.25rem;
}

h4 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  font-weight: 600;
}

.hint {
  margin: 0 0 0.75rem;
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
}

.book-scan {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.upload-label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  align-self: flex-start;
  padding: 0.6rem 1rem;
  border: 1px dashed var(--p-primary-color);
  border-radius: var(--radius-md);
  color: var(--p-primary-color);
  cursor: pointer;
  font-weight: 500;
}

.upload-label.disabled {
  opacity: 0.6;
  cursor: progress;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.scan-status {
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
}

.scan-status.error {
  color: var(--status-error);
}

.interval-rows {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.interval-row {
  display: grid;
  grid-template-columns: minmax(8rem, 1fr) 9rem 6rem 2.5rem;
  gap: 0.5rem;
  align-items: center;
}

.interval-row :deep(input) {
  width: 100%;
}

.interval-head {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.add-row {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.6rem;
  flex-wrap: wrap;
}

.book-entries {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--p-surface-200);
  border-radius: 0.5rem;
}

.book-entry {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--p-surface-200);
  cursor: pointer;
}

.book-entry:last-child {
  border-bottom: none;
}

.entry-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.entry-main small {
  color: var(--p-text-muted-color);
}

.book-entry.duplicate .entry-main {
  opacity: 0.7;
}

.duplicate-note {
  color: var(--p-text-muted-color);
  white-space: nowrap;
}

@media (max-width: 560px) {
  .interval-row {
    grid-template-columns: 1fr 1fr 2.5rem;
  }

  .interval-row > :first-child {
    grid-column: 1 / -1;
  }

  .interval-head {
    display: none;
  }
}
</style>
