<script setup lang="ts">
/**
 * Jahresabo auf Rechnung bestellen, privat oder für einen Betrieb: Rechnungsadresse, Fahrzeugzahl (vorbelegt mit
 * den aktiven Fahrzeugen), Zustimmung zu Verlängerung und Kündigung. Der AI-Proxy legt das Abo an und schickt die
 * QR-Rechnung per Mail (ai-proxy `invoice-subscription.ts`), ohne IBAN den Auftrag an info@wartungsheft.ch, die
 * Rechnung von Hand zu schreiben (ai-proxy `invoice-request.ts`). Privat zahlt einen Preis fürs Konto, Betriebe pro
 * Fahrzeug und bekommen die Rechnung auf die Firma.
 */
import type { Audience } from '@strainovic/ai-proxy/plans'
import type { BusinessOrder } from '../services/ai-access'
import { parseOrder } from '@strainovic/ai-proxy/invoice'
import { BUSINESS_VEHICLE_YEARLY_CHF, PRIVATE_MAX_VEHICLES, PRIVATE_YEARLY_CHF, yearlyPriceChf } from '@strainovic/ai-proxy/plans'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import SelectButton from 'primevue/selectbutton'
import { computed, reactive, ref, watch } from 'vue'
import { formatCurrency, formatDate } from '../lib/locale'
import { orderBusinessPlan, OrderError } from '../services/ai-access'

const props = defineProps<{
  visible: boolean
  /** Vorschlag für die Fahrzeugzahl: aktive Fahrzeuge */
  activeVehicles: number
  /** Ende der Testzeit (ISO), solange sie läuft; das bezahlte Jahr beginnt danach */
  trialEndsAt?: string | null
}>()
const emit = defineEmits<{ close: [], ordered: [result: { number: string, mailed: boolean, manual: boolean }] }>()

const AUDIENCES = [
  { label: 'Privat', value: 'privat' as Audience },
  { label: 'Betrieb', value: 'betrieb' as Audience },
]
const audience = ref<Audience>('privat')
const isBusiness = computed(() => audience.value === 'betrieb')

const form = reactive({
  company: '',
  contact: '',
  street: '',
  zip: '',
  city: '',
  email: '',
  reference: '',
  // Als Text wie im Eingabefeld; vehicleCount macht daraus die Zahl
  vehicles: '1',
  acceptTerms: false,
})
const errors = ref<Partial<Record<keyof BusinessOrder, string>>>({})
const generalError = ref('')
const saving = ref(false)

watch(() => props.visible, (open) => {
  if (!open)
    return
  form.vehicles = String(Math.max(1, props.activeVehicles))
  errors.value = {}
  generalError.value = ''
}, { immediate: true })

const vehicleCount = computed(() => Math.max(1, Math.floor(Number(form.vehicles) || 1)))
const price = computed(() => yearlyPriceChf(vehicleCount.value, audience.value))
// Privat gilt der Kontopreis nur bis zur Fahrzeuggrenze, darüber zählt jedes Fahrzeug
const overPrivateLimit = computed(() => !isBusiness.value && vehicleCount.value > PRIVATE_MAX_VEHICLES)

async function submit(): Promise<void> {
  errors.value = {}
  generalError.value = ''
  // Dieselbe Prüfung wie im Proxy, damit Fehler ohne Umweg über den Server am Feld stehen
  const parsed = parseOrder({ ...form, audience: audience.value, vehicles: vehicleCount.value })
  if (!parsed.ok) {
    errors.value = parsed.errors
    return
  }
  saving.value = true
  try {
    const result = await orderBusinessPlan({ ...parsed.order, acceptTerms: true })
    emit('ordered', { number: result.invoice.number, mailed: result.mailed, manual: !!result.manual })
    emit('close')
  }
  catch (e) {
    if (e instanceof OrderError && Object.keys(e.fields).length)
      errors.value = e.fields
    else
      generalError.value = (e as Error).message
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
    header="Jahresabo bestellen"
    data-testid="business-order-dialog"
    :style="{ width: 'min(560px, 96vw)' }"
    @update:visible="emit('close')"
  >
    <SelectButton
      v-model="audience"
      :options="AUDIENCES"
      option-label="label"
      option-value="value"
      :allow-empty="false"
      class="audience-switch"
      aria-label="Privat oder Betrieb"
    />

    <p class="intro">
      <template v-if="isBusiness">
        {{ formatCurrency(BUSINESS_VEHICLE_YEARLY_CHF) }} pro Fahrzeug und Jahr, Rechnung auf die Firma.
      </template>
      <template v-else>
        {{ formatCurrency(PRIVATE_YEARLY_CHF) }} im Jahr für bis zu {{ PRIVATE_MAX_VEHICLES }} Fahrzeuge.
      </template>
      Du kannst sofort weiterarbeiten, die Rechnung kommt per Mail und ist in 30 Tagen zahlbar.
      <template v-if="trialEndsAt">
        Das bezahlte Jahr beginnt nach deiner Testzeit am {{ formatDate(trialEndsAt) }}.
      </template>
    </p>

    <Message v-if="generalError" severity="error" :closable="false" class="general-error">
      {{ generalError }}
    </Message>

    <form class="fields" @submit.prevent="submit">
      <div v-if="isBusiness" class="field span-2">
        <label for="order-company">Firma</label>
        <InputText id="order-company" v-model="form.company" autocomplete="organization" :invalid="!!errors.company" fluid />
        <small v-if="errors.company" class="error">{{ errors.company }}</small>
      </div>
      <div class="field span-2">
        <label for="order-contact">{{ isBusiness ? 'Kontaktperson' : 'Name' }}</label>
        <InputText id="order-contact" v-model="form.contact" autocomplete="name" :invalid="!!errors.contact" fluid />
        <small v-if="errors.contact" class="error">{{ errors.contact }}</small>
      </div>
      <div class="field span-2">
        <label for="order-street">Strasse und Nummer</label>
        <InputText id="order-street" v-model="form.street" autocomplete="street-address" :invalid="!!errors.street" fluid />
        <small v-if="errors.street" class="error">{{ errors.street }}</small>
      </div>
      <div class="field">
        <label for="order-zip">PLZ</label>
        <InputText id="order-zip" v-model="form.zip" inputmode="numeric" maxlength="4" autocomplete="postal-code" :invalid="!!errors.zip" fluid />
        <small v-if="errors.zip" class="error">{{ errors.zip }}</small>
      </div>
      <div class="field">
        <label for="order-city">Ort</label>
        <InputText id="order-city" v-model="form.city" autocomplete="address-level2" :invalid="!!errors.city" fluid />
        <small v-if="errors.city" class="error">{{ errors.city }}</small>
      </div>
      <div class="field span-2">
        <label for="order-email">E-Mail für die Rechnung</label>
        <InputText id="order-email" v-model="form.email" type="email" autocomplete="email" :invalid="!!errors.email" fluid />
        <small v-if="errors.email" class="error">{{ errors.email }}</small>
      </div>
      <div v-if="isBusiness" class="field">
        <label for="order-reference">Deine Referenz (optional)</label>
        <InputText id="order-reference" v-model="form.reference" placeholder="z. B. Kostenstelle" fluid />
      </div>
      <div class="field">
        <label for="order-vehicles">Anzahl Fahrzeuge</label>
        <InputText id="order-vehicles" v-model="form.vehicles" type="number" min="1" step="1" :invalid="!!errors.vehicles" fluid />
        <small v-if="errors.vehicles" class="error">{{ errors.vehicles }}</small>
      </div>
      <p class="price span-2" data-testid="order-price">
        {{ formatCurrency(price) }} im Jahr
      </p>
      <small v-if="overPrivateLimit" class="hint span-2">
        Über {{ PRIVATE_MAX_VEHICLES }} Fahrzeuge gilt der Preis pro Fahrzeug, {{ formatCurrency(BUSINESS_VEHICLE_YEARLY_CHF) }} im Jahr.
      </small>
      <div class="terms span-2">
        <Checkbox v-model="form.acceptTerms" input-id="order-terms" binary :invalid="!!errors.acceptTerms" />
        <label for="order-terms">
          Das Abo verlängert sich jährlich um ein Jahr, die Rechnung dafür kommt 30 Tage vor Ablauf nach dem dann
          aktuellen Fahrzeugstand. Kündigen geht bis zum Ablauf ohne Frist, hier in den Einstellungen. Es gelten die
          <a href="/agb" target="_blank" rel="noopener">AGB</a>.
        </label>
      </div>
      <small v-if="errors.acceptTerms" class="error span-2">{{ errors.acceptTerms }}</small>
      <button type="submit" hidden />
    </form>

    <template #footer>
      <Button label="Abbrechen" text severity="secondary" @click="emit('close')" />
      <Button label="Kostenpflichtig bestellen" icon="pi pi-check" :loading="saving" @click="submit" />
    </template>
  </Dialog>
</template>

<style scoped>
.audience-switch {
  margin-bottom: 1rem;
}

.hint {
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
}

.intro {
  margin: 0 0 1rem;
  font-size: 0.9rem;
  line-height: 1.5;
}

.general-error {
  margin-bottom: 1rem;
}

.fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.span-2 {
  grid-column: span 2;
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

.error {
  color: var(--p-red-500);
  font-size: 0.8rem;
}

.price {
  margin: 0.25rem 0 0;
  font-weight: 600;
  font-size: 1.05rem;
}

.terms {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  font-size: 0.85rem;
  line-height: 1.45;
}

@media (max-width: 480px) {
  .fields {
    grid-template-columns: 1fr;
  }

  .span-2 {
    grid-column: span 1;
  }
}
</style>
