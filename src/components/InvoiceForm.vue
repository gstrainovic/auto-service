<script setup lang="ts">
import type { BatchEntry, BatchVehicle } from '../services/invoice-scan'
import type { InvoiceFormData } from '../types/forms'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import FloatLabel from 'primevue/floatlabel'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { z } from 'zod'
import { useFormValidation } from '../composables/useFormValidation'
import { useInvoiceScan } from '../composables/useInvoiceScan'
import { userMessage } from '../lib/errors'
import { DEFAULT_CURRENCY, formatCurrency, formatDate, LOCALE } from '../lib/locale'
import { MAINTENANCE_CATEGORIES, parseInvoiceFromSpeech } from '../services/ai'
import { getAiAccess } from '../services/ai-access'
import { itemsExceedTotal } from '../services/invoice-items'
import { fillEmptyFields, scannedToFormFields } from '../services/invoice-scan'
import { categoryLabel } from '../services/report'
import DictateButton from './DictateButton.vue'

interface Props {
  initialData?: Partial<InvoiceFormData>
  /** bereits erfasste Rechnungen (alle Fahrzeuge, mit vehicleId), für die Duplikat-Markierung im Stapel */
  existingInvoices?: { vehicleId?: string, date: string, totalAmount?: number }[]
  /** Fahrzeuge des Kontos, für den Abgleich des Kontrollschilds */
  vehicles?: BatchVehicle[]
  /** offenes Fahrzeug */
  vehicleId?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  submit: [data: InvoiceFormData & { imageBase64?: string, scanPending?: boolean }]
  submitBatch: [entries: BatchEntry[]]
  cancel: []
}>()

const scan = useInvoiceScan()
const toast = useToast()
const { imagePreview, imageBase64, pdfName } = scan
const isScanning = computed(() => scan.status.value === 'scanning')
// Hat der Nutzer die Währung selbst umgestellt, überschreibt der Scan sie nicht
const currencyTouched = ref(false)
// Stapel aus Sammel-PDF oder mehreren Fotos; solange gesetzt, ersetzt die Prüfliste die Formularfelder
const batch = ref<BatchEntry[] | null>(null)
// offline aufgenommen: der Scan fehlt noch und wird nachgeholt
const scanPending = ref(false)
const selectedCount = computed(() => batch.value?.filter(e => e.selected && e.draft).length ?? 0)

// Form schema
const invoiceSchema = z.object({
  date: z.string().min(1, 'Datum ist erforderlich'),
  workshop: z.string().optional(),
  amount: z.number().positive('Betrag muss positiv sein').optional(),
  category: z.enum(MAINTENANCE_CATEGORIES).optional(),
  description: z.string().optional(),
  mileage: z.number().positive('Kilometerstand muss positiv sein').optional(),
})

const { errors, validate } = useFormValidation(invoiceSchema)

// Currency options
const currencyOptions = [
  { label: 'CHF', value: 'CHF' as const },
  { label: 'EUR', value: 'EUR' as const },
]

// Form data
const formData = ref<InvoiceFormData>({
  date: props.initialData?.date || '',
  workshop: props.initialData?.workshop || '',
  amount: props.initialData?.amount,
  currency: props.initialData?.currency || DEFAULT_CURRENCY,
  category: props.initialData?.category,
  description: props.initialData?.description || '',
  mileage: props.initialData?.mileage,
  items: props.initialData?.items ? [...props.initialData.items] : [],
})

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  if (!files.length)
    return
  batch.value = null
  const outcome = await scan.handleFiles(files, props.existingInvoices ?? [], { vehicles: props.vehicles, currentVehicleId: props.vehicleId })
  if (outcome?.kind === 'single') {
    formData.value = fillEmptyFields(formData.value, outcome.fields, { currencyTouched: currencyTouched.value })
    // offline fotografiert: der Beleg merkt sich, dass der Scan noch fehlt
    scanPending.value = outcome.scanPending === true
  }
  else if (outcome?.kind === 'batch') {
    batch.value = outcome.entries
  }
}

/**
 * Gesprochene Rechnung: das Diktat kommt als Text zurück und geht durch dieselbe Auswertung wie ein Foto.
 * Gefüllt werden nur leere Felder, der Nutzer prüft alles vor dem Speichern.
 */
const ansageLaeuft = ref(false)
async function ansageUebernehmen(gesprochen: string): Promise<void> {
  ansageLaeuft.value = true
  try {
    const access = await getAiAccess()
    const parsed = await parseInvoiceFromSpeech(gesprochen, access)
    // Dieselbe Aufbereitung wie beim Foto: Kategorien korrigieren, Positionen prüfen, nur leere Felder füllen
    formData.value = fillEmptyFields(formData.value, scannedToFormFields(parsed), { currencyTouched: currencyTouched.value })
  }
  catch (e) {
    ansageFehler(userMessage(e))
  }
  finally {
    ansageLaeuft.value = false
  }
}

function ansageFehler(meldung: string): void {
  toast.add({ severity: 'warn', summary: 'Ansage', detail: meldung, life: 5000 })
}

const vehicleOptions = computed(() => (props.vehicles ?? []).map(v => ({ label: `${v.make} ${v.model}${v.licensePlate ? ` · ${v.licensePlate}` : ''}`, value: v.id })))

function saveBatch() {
  if (batch.value && selectedCount.value)
    emit('submitBatch', batch.value.filter(e => e.selected && e.draft))
}

// Positionen, die zusammen mehr als die Rechnung ergeben, sind fast immer falsch gelesen
const itemsWarning = computed(() => itemsExceedTotal(formData.value.items ?? [], formData.value.amount ?? 0))

function removeItem(index: number) {
  formData.value.items = (formData.value.items ?? []).filter((_, i) => i !== index)
}

// Computed currency for InputNumber
const selectedCurrency = computed(() => formData.value.currency || DEFAULT_CURRENCY)

// Kategorien mit Anzeigenamen (Ölwechsel, MFK / Prüfung …)
const categoryOptions = MAINTENANCE_CATEGORIES.map(cat => ({
  label: categoryLabel(cat),
  value: cat,
}))

function handleSubmit() {
  if (validate(formData.value)) {
    emit('submit', {
      ...formData.value,
      ...(imageBase64.value ? { imageBase64: imageBase64.value } : {}),
      ...(scanPending.value ? { scanPending: true } : {}),
    })
  }
}

function handleCancel() {
  emit('cancel')
}
</script>

<template>
  <form class="invoice-form" @submit.prevent="handleSubmit">
    <div class="form-grid">
      <!-- Beleg zuerst: Foto oder PDF wird ausgerichtet, gelesen und füllt leere Felder -->
      <div class="beleg">
        <label class="upload-label" :class="{ disabled: isScanning }">
          <i class="pi pi-camera" />
          {{ imagePreview || pdfName || batch ? 'Andere Rechnung wählen' : 'Rechnung fotografieren oder PDF wählen' }}
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            class="file-input"
            :disabled="isScanning"
            @change="onFileChange"
          >
        </label>
        <!-- Kein Beleg zur Hand: die Rechnung in einem Satz ansagen, der Rest läuft wie beim Foto -->
        <div class="ansage">
          <DictateButton label="Rechnung ansagen" size="small" @text="ansageUebernehmen" @fehler="ansageFehler" />
          <small class="field-hint">
            Oder ansagen: «Muster-Garage, 14. September, 486.50, 118'400 Kilometer, Ölwechsel und Bremsbeläge vorne.»
          </small>
        </div>
        <div v-if="ansageLaeuft" class="scan-status" role="status">
          <i class="pi pi-spin pi-spinner" />
          Ansage wird ausgewertet …
        </div>
        <small v-if="!batch && !imagePreview && !pdfName && !isScanning && !scan.message.value" class="field-hint">
          Mehrere Fotos oder ein PDF mit mehreren Rechnungen werden einzeln erfasst.
        </small>
        <div v-if="isScanning" class="scan-status" role="status">
          <i class="pi pi-spin pi-spinner" />
          {{ scan.progress.value }}
        </div>
        <small v-else-if="scan.message.value" class="scan-message" :class="{ error: scan.status.value === 'error' }" role="status">
          {{ scan.message.value }}
        </small>
        <div v-if="imagePreview" class="image-preview">
          <img :src="imagePreview" alt="Rechnung">
        </div>
        <div v-else-if="pdfName && !batch" class="pdf-name">
          <i class="pi pi-file-pdf" /> {{ pdfName }}
          <small>PDF wird nur gelesen, nicht als Bild gespeichert.</small>
        </div>
      </div>

      <!-- Stapel: jede erkannte Rechnung eine Zeile, schon erfasste abgewählt -->
      <div v-if="batch" class="batch" aria-label="Erkannte Rechnungen">
        <div
          v-for="(entry, i) in batch"
          :key="i"
          class="batch-row"
          :class="{ muted: !entry.draft || entry.duplicate }"
        >
          <Checkbox v-model="entry.selected" :binary="true" :disabled="!entry.draft" :input-id="`batch-${i}`" />
          <span class="batch-text">
            <label :for="`batch-${i}`">
              <template v-if="entry.draft">
                <span class="batch-main">{{ formatDate(entry.draft.date) }} · {{ entry.draft.workshopName || 'Werkstatt unbekannt' }}</span>
                <small>
                  {{ entry.source }} · {{ entry.draft.items.length }} {{ entry.draft.items.length === 1 ? 'Position' : 'Positionen' }}
                  <span v-if="entry.duplicate" class="batch-dup">· {{ entry.duplicate }}</span>
                  <span v-else-if="itemsExceedTotal(entry.draft.items, entry.draft.totalAmount)" class="batch-dup">· Positionen ergeben mehr als das Total</span>
                </small>
                <small v-if="entry.plateNote" class="batch-dup batch-plate">{{ entry.plateNote }}</small>
              </template>
              <template v-else>
                <span class="batch-main">Nicht lesbar</span>
                <small>{{ entry.source }} · Datum oder Betrag fehlt</small>
              </template>
            </label>
            <Select
              v-if="entry.draft && vehicleOptions.length > 1"
              v-model="entry.vehicleId"
              :options="vehicleOptions"
              option-label="label"
              option-value="value"
              size="small"
              class="batch-vehicle"
              :aria-label="`Fahrzeug für Rechnung ${i + 1}`"
            />
          </span>
          <span v-if="entry.draft" class="batch-amount">{{ formatCurrency(entry.draft.totalAmount, entry.draft.currency) }}</span>
        </div>
      </div>

      <template v-if="!batch">
        <!-- Datumsfelder zeigen immer «TT.MM.JJJJ», ein schwebendes Label läge darüber -->
        <div class="field">
          <label for="invoice-date">Datum *</label>
          <InputText
            id="invoice-date"
            v-model="formData.date"
            name="date"
            type="date"
            :invalid="!!errors.date"
            fluid
          />
        </div>
        <small v-if="errors.date" class="error">{{ errors.date }}</small>

        <FloatLabel>
          <InputText
            id="invoice-workshop"
            v-model="formData.workshop"
            name="workshop"
            fluid
          />
          <label for="invoice-workshop">Werkstatt</label>
        </FloatLabel>

        <div class="amount-row">
          <FloatLabel class="amount-input">
            <InputNumber
              id="invoice-amount"
              v-model="formData.amount"
              name="amount"
              mode="currency"
              :currency="selectedCurrency"
              :locale="LOCALE"
              :invalid="!!errors.amount"
              fluid
            />
            <label for="invoice-amount">Betrag</label>
          </FloatLabel>
          <SelectButton
            v-model="formData.currency"
            :options="currencyOptions"
            option-label="label"
            option-value="value"
            class="currency-toggle"
            @update:model-value="currencyTouched = true"
          />
        </div>
        <small v-if="errors.amount" class="error">{{ errors.amount }}</small>

        <FloatLabel>
          <InputNumber
            id="invoice-mileage"
            v-model="formData.mileage"
            name="mileage"
            :use-grouping="true"
            :locale="LOCALE"
            suffix=" km"
            :invalid="!!errors.mileage"
            fluid
          />
          <label for="invoice-mileage">Kilometerstand</label>
        </FloatLabel>
        <small v-if="errors.mileage" class="error">{{ errors.mileage }}</small>

        <!-- Positionen aus dem Scan ersetzen Kategorie und Beschreibung -->
        <div v-if="formData.items?.length" class="scan-items" aria-label="Erkannte Positionen">
          <div class="scan-items-title">
            Erkannte Positionen
          </div>
          <div v-for="(item, i) in formData.items" :key="i" class="scan-item">
            <div class="scan-item-text">
              <div>{{ item.description || categoryLabel(item.category) }}</div>
              <small>{{ categoryLabel(item.category) }}</small>
            </div>
            <span class="scan-item-amount">{{ formatCurrency(item.amount, formData.currency) }}</span>
            <Button
              v-tooltip.left="'Position entfernen'"
              type="button"
              icon="pi pi-times"
              text
              rounded
              severity="secondary"
              size="small"
              aria-label="Position entfernen"
              @click="removeItem(i)"
            />
          </div>
          <div v-if="itemsWarning" class="items-warning" role="alert">
            <i class="pi pi-exclamation-triangle" />
            Positionen ergeben {{ formatCurrency(itemsWarning.itemsSum, formData.currency) }}, die Rechnung {{ formatCurrency(itemsWarning.total, formData.currency) }}. Bitte Positionen prüfen.
          </div>
        </div>

        <template v-else>
          <FloatLabel>
            <Select
              id="invoice-category"
              v-model="formData.category"
              name="category"
              :options="categoryOptions"
              option-label="label"
              option-value="value"
              fluid
            />
            <label for="invoice-category">Kategorie</label>
          </FloatLabel>

          <FloatLabel>
            <Textarea
              id="invoice-description"
              v-model="formData.description"
              name="description"
              rows="3"
              fluid
            />
            <label for="invoice-description">Beschreibung</label>
          </FloatLabel>
        </template>
      </template>
    </div>

    <div class="form-actions">
      <Button type="button" label="Abbrechen" severity="secondary" @click="handleCancel" />
      <Button
        v-if="batch"
        type="button"
        :label="selectedCount === 1 ? '1 Rechnung speichern' : `${selectedCount} Rechnungen speichern`"
        :disabled="isScanning || !selectedCount"
        @click="saveBatch"
      />
      <Button v-else type="submit" label="Speichern" :disabled="isScanning" />
    </div>
  </form>
</template>

<style scoped>
.invoice-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.amount-row {
  display: flex;
  gap: var(--spacing-sm);
  align-items: flex-start;
}

.amount-input {
  flex: 1;
}

.currency-toggle {
  flex-shrink: 0;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}

.error {
  color: var(--status-error);
  display: block;
  margin-top: calc(var(--spacing-xs) * -1);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field > label {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}

.ansage {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  margin-top: 0.4rem;
}

.field-hint {
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
}

.batch {
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  max-height: 50vh;
  overflow-y: auto;
}

.batch-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--surface-border);
  cursor: pointer;
}

.batch-row:last-child {
  border-bottom: none;
}

.batch-row.muted .batch-main,
.batch-row.muted .batch-amount {
  color: var(--p-text-muted-color);
}

.batch-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.batch-text small {
  color: var(--p-text-muted-color);
}

.batch-dup {
  color: var(--status-warning);
}

.batch-text label {
  display: flex;
  flex-direction: column;
  cursor: pointer;
}

.batch-vehicle {
  margin-top: 0.35rem;
  max-width: 100%;
}

.batch-amount {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.beleg {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.upload-label.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.scan-status,
.scan-message {
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
}

.scan-status {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.pdf-name {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-xs) var(--spacing-sm);
}

.pdf-name small {
  flex-basis: 100%;
  color: var(--p-text-muted-color);
}

.items-warning {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-top: 1px solid var(--surface-border);
  color: var(--status-warning);
  font-size: 0.85rem;
}

.scan-items {
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
}

.scan-items-title {
  padding: var(--spacing-sm) var(--spacing-md) 0;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--p-text-muted-color);
}

.scan-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-sm) var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--surface-border);
}

.scan-item:last-child {
  border-bottom: none;
}

.scan-item-text {
  flex: 1;
  min-width: 0;
}

.scan-item-text small {
  color: var(--p-text-muted-color);
}

.scan-item-amount {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.upload-label {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px dashed var(--surface-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--p-text-muted-color);
  transition: border-color 0.2s;
}

.upload-label:hover {
  border-color: var(--p-primary-color);
  color: var(--p-primary-color);
}

.file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

.image-preview {
  max-width: 200px;
}

.image-preview img {
  width: 100%;
  border-radius: var(--radius-md);
  border: 1px solid var(--surface-border);
}
</style>
