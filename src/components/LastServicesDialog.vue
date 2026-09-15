<script setup lang="ts">
/**
 * Nach dem Anlegen eines Fahrzeugs (oder später bei einem Fahrzeug ohne Einträge): wann wurden die wichtigsten
 * Arbeiten zuletzt gemacht? Ohne diese Angaben kennt die App keine Fälligkeit und schickt nie eine Erinnerung.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import { computed, ref, watch } from 'vue'
import { LOCALE } from '../lib/locale'
import { saveMaintenances } from '../services/maintenance-save'

const props = defineProps<{
  visible: boolean
  vehicleId: string | null
  vehicleName?: string
}>()

const emit = defineEmits<{ 'update:visible': [value: boolean], 'saved': [] }>()

const ROWS = [
  { type: 'inspektion', label: 'Service / Inspektion' },
  { type: 'oelwechsel', label: 'Ölwechsel' },
  { type: 'tuev', label: 'MFK / Prüfung' },
  { type: 'bremsflüssigkeit', label: 'Bremsflüssigkeit' },
  { type: 'zahnriemen', label: 'Zahnriemen' },
] as const

const rows = ref(ROWS.map(r => ({ ...r, date: '', mileage: null as number | null })))
const saving = ref(false)
const filled = computed(() => rows.value.filter(r => r.date))

watch(() => props.visible, (v) => {
  if (v)
    rows.value = ROWS.map(r => ({ ...r, date: '', mileage: null }))
})

const today = new Date().toISOString().slice(0, 10)

async function save(): Promise<void> {
  if (!props.vehicleId || !filled.value.length)
    return
  saving.value = true
  try {
    await saveMaintenances(filled.value.map(r => ({
      vehicleId: props.vehicleId!,
      type: r.type,
      description: '',
      doneAt: r.date,
      mileageAtService: r.mileage,
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
    header="Wann wurde zuletzt …?"
    data-testid="last-services-dialog"
    :style="{ width: 'min(560px, 94vw)' }"
    @update:visible="emit('update:visible', $event)"
  >
    <p class="intro">
      <template v-if="vehicleName">
        <strong>{{ vehicleName }}</strong>:
      </template>
      Trag ein, was du weisst, zum Beispiel aus dem Serviceheft oder dem letzten MFK-Bericht. Leere Zeilen bleiben leer.
      Daraus berechnet Wartungsheft die nächsten Termine und erinnert dich rechtzeitig.
    </p>
    <div class="rows" role="table" aria-label="Letzte Wartungen">
      <div v-for="row in rows" :key="row.type" class="row" role="row">
        <label :for="`last-${row.type}-date`" class="row-label">{{ row.label }}</label>
        <InputText :id="`last-${row.type}-date`" v-model="row.date" type="date" :max="today" class="row-date" />
        <InputNumber
          v-model="row.mileage"
          :input-id="`last-${row.type}-km`"
          :locale="LOCALE"
          suffix=" km"
          placeholder="km (optional)"
          :aria-label="`${row.label} Kilometerstand`"
          class="row-km"
        />
      </div>
    </div>
    <template #footer>
      <Button label="Später" text severity="secondary" @click="emit('update:visible', false)" />
      <Button
        :label="filled.length ? `${filled.length} ${filled.length === 1 ? 'Eintrag' : 'Einträge'} speichern` : 'Speichern'"
        :disabled="!filled.length"
        :loading="saving"
        @click="save"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.intro {
  margin: 0 0 1rem;
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
  line-height: 1.5;
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.row {
  display: grid;
  grid-template-columns: minmax(8rem, 1fr) 10rem 9rem;
  gap: 0.5rem;
  align-items: center;
}

.row-label {
  font-weight: 500;
}

.row-date,
.row-km,
.row-km :deep(input) {
  width: 100%;
}

@media (max-width: 520px) {
  .row {
    grid-template-columns: 1fr 1fr;
  }

  .row-label {
    grid-column: 1 / -1;
  }
}
</style>
