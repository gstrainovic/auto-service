<script setup lang="ts">
import type { InvoiceFormData } from '../types/forms'
import Button from 'primevue/button'
import FloatLabel from 'primevue/floatlabel'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { computed, ref } from 'vue'
import { z } from 'zod'
import { useFormValidation } from '../composables/useFormValidation'
import { useInvoiceScan } from '../composables/useInvoiceScan'
import { DEFAULT_CURRENCY, formatCurrency, LOCALE } from '../lib/locale'
import { MAINTENANCE_CATEGORIES } from '../services/ai'
import { fillEmptyFields } from '../services/invoice-scan'
import { categoryLabel } from '../services/report'

interface Props {
  initialData?: Partial<InvoiceFormData>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  submit: [data: InvoiceFormData & { imageBase64?: string }]
  cancel: []
}>()

const scan = useInvoiceScan()
const { imagePreview, imageBase64, pdfName } = scan
const isScanning = computed(() => scan.status.value === 'preparing' || scan.status.value === 'scanning')
// Hat der Nutzer die Währung selbst umgestellt, überschreibt der Scan sie nicht
const currencyTouched = ref(false)

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
  const file = input.files?.[0]
  input.value = ''
  if (!file)
    return
  const fields = await scan.handleFile(file)
  if (fields)
    formData.value = fillEmptyFields(formData.value, fields, { currencyTouched: currencyTouched.value })
}

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
          {{ imagePreview || pdfName ? 'Anderen Beleg wählen' : 'Beleg fotografieren oder PDF wählen' }}
          <input
            type="file"
            accept="image/*,application/pdf"
            class="file-input"
            :disabled="isScanning"
            @change="onFileChange"
          >
        </label>
        <div v-if="isScanning" class="scan-status" role="status">
          <i class="pi pi-spin pi-spinner" />
          {{ scan.status.value === 'preparing' ? 'Beleg wird ausgerichtet …' : 'Beleg wird gelesen …' }}
        </div>
        <small v-else-if="scan.message.value" class="scan-message" :class="{ error: scan.status.value === 'error' }" role="status">
          {{ scan.message.value }}
        </small>
        <div v-if="imagePreview" class="image-preview">
          <img :src="imagePreview" alt="Beleg">
        </div>
        <div v-else-if="pdfName" class="pdf-name">
          <i class="pi pi-file-pdf" /> {{ pdfName }}
          <small>PDF wird nur gelesen, nicht als Bild gespeichert.</small>
        </div>
      </div>

      <FloatLabel>
        <InputText
          id="invoice-date"
          v-model="formData.date"
          name="date"
          type="date"
          :invalid="!!errors.date"
          fluid
        />
        <label for="invoice-date">Datum *</label>
      </FloatLabel>
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
    </div>

    <div class="form-actions">
      <Button type="button" label="Abbrechen" severity="secondary" @click="handleCancel" />
      <Button type="submit" label="Speichern" :disabled="isScanning" />
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
