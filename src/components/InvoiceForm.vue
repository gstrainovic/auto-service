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
import { useImageUpload } from '../composables/useImageUpload'
import { MAINTENANCE_CATEGORIES } from '../services/ai'

interface Props {
  initialData?: Partial<InvoiceFormData>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  submit: [data: InvoiceFormData & { imageBase64?: string }]
  cancel: []
}>()

const { imagePreview, imageBase64, error: imageError, isProcessing, handleFile } = useImageUpload()

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file)
    handleFile(file)
}

// Form schema
const invoiceSchema = z.object({
  date: z.string().min(1, 'Datum ist erforderlich'),
  workshop: z.string().optional(),
  amount: z.number().positive('Betrag muss positiv sein').optional(),
  category: z.enum(MAINTENANCE_CATEGORIES).optional(),
  description: z.string().optional(),
})

const { errors, validate } = useFormValidation(invoiceSchema)

// Currency options
const currencyOptions = [
  { label: 'EUR', value: 'EUR' as const },
  { label: 'CHF', value: 'CHF' as const },
]

// Form data
const formData = ref<InvoiceFormData>({
  date: props.initialData?.date || '',
  workshop: props.initialData?.workshop || '',
  amount: props.initialData?.amount,
  currency: props.initialData?.currency || 'EUR',
  category: props.initialData?.category,
  description: props.initialData?.description || '',
})

// Computed currency for InputNumber
const selectedCurrency = computed(() => formData.value.currency || 'EUR')

// Category options
const categoryOptions = MAINTENANCE_CATEGORIES.map(cat => ({
  label: cat.charAt(0).toUpperCase() + cat.slice(1),
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
            locale="de-DE"
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
        />
      </div>
      <small v-if="errors.amount" class="error">{{ errors.amount }}</small>

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

      <div class="image-upload">
        <label class="upload-label">
          <i class="pi pi-camera" />
          Foto hinzufügen
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="file-input"
            @change="onFileChange"
          >
        </label>
        <small v-if="imageError" class="error">{{ imageError }}</small>
        <div v-if="isProcessing" class="image-processing">
          <i class="pi pi-spin pi-spinner" /> Wird verarbeitet...
        </div>
        <div v-if="imagePreview" class="image-preview">
          <img :src="imagePreview" alt="Vorschau">
        </div>
      </div>
    </div>

    <div class="form-actions">
      <Button type="button" label="Abbrechen" severity="secondary" @click="handleCancel" />
      <Button type="submit" label="Speichern" />
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

.image-upload {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
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

.image-processing {
  color: var(--p-text-muted-color);
  font-size: var(--text-sm);
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
