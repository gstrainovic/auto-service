<script setup lang="ts">
import type { MaintenanceFormData } from '../types/forms'
import Button from 'primevue/button'
import FloatLabel from 'primevue/floatlabel'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { ref } from 'vue'
import { z } from 'zod'
import { useFormValidation } from '../composables/useFormValidation'
import { LOCALE } from '../lib/locale'
import { MAINTENANCE_CATEGORIES } from '../services/ai'
import { categoryLabel } from '../services/report'
import DictateButton from './DictateButton.vue'

interface Props {
  initialData?: Partial<MaintenanceFormData>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  submit: [data: MaintenanceFormData]
  cancel: []
}>()

// Form schema
const maintenanceSchema = z.object({
  category: z.enum(MAINTENANCE_CATEGORIES, { message: 'Kategorie ist erforderlich' }),
  date: z.string().min(1, 'Datum ist erforderlich'),
  mileage: z.number().positive('Kilometerstand muss positiv sein').optional(),
  description: z.string().optional(),
  status: z.enum(['done', 'planned']).optional(),
})

const { errors, validate } = useFormValidation(maintenanceSchema)

// Form data
const formData = ref<MaintenanceFormData>({
  category: props.initialData?.category || '' as any,
  date: props.initialData?.date || '',
  mileage: props.initialData?.mileage,
  description: props.initialData?.description || '',
  status: props.initialData?.status || 'done',
})

// Kategorien mit Anzeigenamen (Ölwechsel, MFK / Prüfung …)
const categoryOptions = MAINTENANCE_CATEGORIES.map(cat => ({
  label: categoryLabel(cat),
  value: cat,
}))

// Status options
const statusOptions = [
  { label: 'Erledigt', value: 'done' },
  { label: 'Geplant (Termin vereinbart)', value: 'planned' },
]

function handleSubmit() {
  if (validate(formData.value)) {
    emit('submit', formData.value)
  }
}

function handleCancel() {
  emit('cancel')
}
</script>

<template>
  <form class="maintenance-form" @submit.prevent="handleSubmit">
    <div class="form-grid">
      <FloatLabel>
        <Select
          id="maintenance-category"
          v-model="formData.category"
          name="category"
          :options="categoryOptions"
          option-label="label"
          option-value="value"
          :invalid="!!errors.category"
          fluid
        />
        <label for="maintenance-category">Kategorie *</label>
      </FloatLabel>
      <small v-if="errors.category" class="error">{{ errors.category }}</small>

      <!-- Datumsfelder zeigen immer «TT.MM.JJJJ», ein schwebendes Label läge darüber -->
      <div class="field">
        <label for="maintenance-date">{{ formData.status === 'planned' ? 'Termin *' : 'Datum *' }}</label>
        <InputText
          id="maintenance-date"
          v-model="formData.date"
          name="date"
          type="date"
          :invalid="!!errors.date"
          fluid
        />
      </div>
      <small v-if="errors.date" class="error">{{ errors.date }}</small>

      <FloatLabel>
        <InputNumber
          id="maintenance-mileage"
          v-model="formData.mileage"
          name="mileage"
          :use-grouping="true"
          :locale="LOCALE"
          suffix=" km"
          :invalid="!!errors.mileage"
          fluid
        />
        <label for="maintenance-mileage">Kilometerstand</label>
      </FloatLabel>
      <small v-if="errors.mileage" class="error">{{ errors.mileage }}</small>

      <FloatLabel>
        <Select
          id="maintenance-status"
          v-model="formData.status"
          name="status"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          fluid
        />
        <label for="maintenance-status">Status</label>
      </FloatLabel>

      <FloatLabel>
        <Textarea
          id="maintenance-description"
          v-model="formData.description"
          name="description"
          rows="3"
          fluid
        />
        <label for="maintenance-description">Beschreibung</label>
      </FloatLabel>
      <!-- Ganze Sätze diktieren geht gut, einzelne Fachwörter schlecht (stt-vergleich.md) -->
      <DictateButton label="Beschreibung diktieren" @text="t => formData.description = [formData.description, t].filter(Boolean).join(' ')" />
    </div>

    <div class="form-actions">
      <Button type="button" label="Abbrechen" severity="secondary" @click="handleCancel" />
      <Button type="submit" label="Speichern" />
    </div>
  </form>
</template>

<style scoped>
.maintenance-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
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
</style>
