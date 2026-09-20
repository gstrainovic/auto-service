<script setup lang="ts">
import type { LimitKind, Plan } from '@strainovic/ai-proxy/plans'
import { BUSINESS_VEHICLE_YEARLY_CHF, PLANS, PRIVATE_MAX_VEHICLES, PRIVATE_YEARLY_CHF } from '@strainovic/ai-proxy/plans'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Message from 'primevue/message'
import ProgressBar from 'primevue/progressbar'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref } from 'vue'
import OrderDialog from '../components/OrderDialog.vue'
import { userMessage } from '../lib/errors'
import { db, tx } from '../lib/instantdb'
import { formatCurrency, formatDate, formatMonth, formatNumber } from '../lib/locale'
import { cancelBusinessPlan, fetchUsage, resumeBusinessPlan, startCheckout } from '../services/ai-access'
import { exportDatabase, importDatabase } from '../services/db-export'
import { activeVehicles } from '../services/vehicle-status'
import { useRemindersStore } from '../stores/reminders'
import { HOME_CURRENCIES, useSettingsStore } from '../stores/settings'
import { useVehiclesStore } from '../stores/vehicles'

type UsageInfo = Awaited<ReturnType<typeof fetchUsage>>

// Nutzertexte für die Zähler und die Plan-Namen des Katalogs
const LIMIT_LABELS: Record<LimitKind, string> = {
  ocrPages: 'Scans',
  chatTokens: 'Chat',
}
const IMPORT_LABELS: Record<string, [singular: string, plural: string]> = {
  vehicles: ['Fahrzeug', 'Fahrzeuge'],
  invoices: ['Rechnung', 'Rechnungen'],
  maintenances: ['Wartung', 'Wartungen'],
  ocrCache: ['Scan', 'Scans'],
  chatmessages: ['Chat-Nachricht', 'Chat-Nachrichten'],
}

// Upgrade-Buttons nur mit konfiguriertem Zahlungsanbieter (VITE_BILLING_ENABLED=true beim Build). Bis dahin
// zahlen die ersten Kunden per Jahresrechnung, Kontakt statt Checkout.
const billingEnabled = import.meta.env.VITE_BILLING_ENABLED === 'true'
const CONTACT_EMAIL = 'info@wartungsheft.ch'

const settings = useSettingsStore()
const reminders = useRemindersStore()
const toast = useToast()

async function toggleEmailReminders(enabled: boolean): Promise<void> {
  try {
    await reminders.setEmailReminders(enabled)
  }
  catch (err) {
    toast.add({ severity: 'error', summary: 'Einstellung nicht gespeichert', detail: userMessage(err), life: 4000 })
  }
}
const ocrCacheCount = ref(0)
const importInput = ref<HTMLInputElement | null>(null)

// Abo & Nutzung (über den AI-Proxy)
const usage = ref<UsageInfo | null>(null)
const usageError = ref('')
const checkoutBusy = ref<string | null>(null)

// Jahresabo auf Rechnung (privat oder Betrieb): bestellen, Stand, kündigen (ai-proxy invoice-subscription.ts)
const vehiclesStore = useVehiclesStore()
const orderOpen = ref(false)
const businessBusy = ref(false)
const business = computed(() => usage.value?.billing ?? null)
const activeVehicleCount = computed(() => activeVehicles(vehiclesStore.vehicles).length)
const canOrderBusiness = computed(() => !!usage.value && !business.value && usage.value.plan === 'free')

function onOrdered(result: { number: string, mailed: boolean }): void {
  toast.add({
    severity: 'success',
    summary: `Jahresabo bestellt, Rechnung ${result.number}`,
    detail: result.mailed ? 'Die QR-Rechnung ist per Mail unterwegs.' : `Die Rechnung kommt in Kürze. Fragen an ${CONTACT_EMAIL}.`,
    life: 6000,
  })
  refreshUsage()
}

async function changeBusinessPlan(action: 'cancel' | 'resume'): Promise<void> {
  businessBusy.value = true
  try {
    if (action === 'cancel') {
      // Vor Beginn des bezahlten Jahres storniert die Kündigung die Rechnung, die Testzeit läuft weiter
      const { voided } = await cancelBusinessPlan()
      toast.add({
        severity: 'info',
        summary: 'Abo gekündigt',
        detail: voided ? 'Die Rechnung ist storniert, du musst nichts bezahlen.' : 'Es läuft bis zum Ende der Laufzeit.',
        life: 6000,
      })
    }
    else {
      await resumeBusinessPlan()
    }
    await refreshUsage()
  }
  catch (e) {
    toast.add({ severity: 'warn', summary: (e as Error).message, life: 5000 })
  }
  finally {
    businessBusy.value = false
  }
}

/** Letzter Tag der bezahlten Laufzeit (periodEnd ist exklusiv) */
function lastPaidDay(periodEnd: string): string {
  const [y, m, d] = periodEnd.split('-').map(Number)
  return formatDate(new Date(Date.UTC(y!, m! - 1, d! - 1)).toISOString().slice(0, 10))
}
const currentPlan = computed(() => PLANS[usage.value?.plan ?? 'free'])
const upgradePlans = computed(() => Object.values(PLANS).filter(p => p.priceChfPerMonth > currentPlan.value.priceChfPerMonth))
const limitKinds = Object.keys(LIMIT_LABELS) as LimitKind[]

function planName(plan: Plan): string {
  return plan.id === 'free' ? 'Testzeit' : plan.name
}

// Testzeit: 30 Tage alles, danach brauchen KI-Scan und Chat ein Abo; Lesen, Erfassen und Exporte bleiben frei
const trialNote = computed(() => {
  const trial = usage.value?.trial
  if (!trial)
    return ''
  if (trial.active)
    return `Testzeit: noch ${trial.daysLeft} ${trial.daysLeft === 1 ? 'Tag' : 'Tage'} mit allem, bis ${formatDate(trial.endsAt)}. Danach kostet Wartungsheft ${formatCurrency(PRIVATE_YEARLY_CHF)} im Jahr (privat, bis ${PRIVATE_MAX_VEHICLES} Fahrzeuge) oder ${formatCurrency(BUSINESS_VEHICLE_YEARLY_CHF)} pro Fahrzeug und Jahr (Betrieb).`
  return `Testzeit vorbei: KI-Scan und Chat brauchen ein Abo (privat ${formatCurrency(PRIVATE_YEARLY_CHF)} im Jahr bis ${PRIVATE_MAX_VEHICLES} Fahrzeuge, Betrieb ${formatCurrency(BUSINESS_VEHICLE_YEARLY_CHF)} pro Fahrzeug und Jahr). Lesen, Erfassen von Hand und Exporte gehen weiter.`
})

// Abgerechnet wird im Jahr: Privat pro Konto, Betrieb pro Fahrzeug
function planPrice(plan: Plan): string {
  if (plan.priceChfPerMonth === 0)
    return 'gratis'
  const yearly = formatCurrency(Math.round(plan.priceChfPerMonth * 12 * 100) / 100)
  return plan.perVehicle ? `${yearly} pro Fahrzeug und Jahr` : `${yearly} / Jahr`
}

function importSummary(imported: Record<string, number>): string {
  return Object.entries(imported)
    .map(([key, count]) => {
      const [singular, plural] = IMPORT_LABELS[key] ?? [key, key]
      return `${count} ${count === 1 ? singular : plural}`
    })
    .join(', ')
}

function usagePercent(kind: LimitKind): number {
  if (!usage.value)
    return 0
  return Math.min(100, Math.round((usage.value.usage[kind] / usage.value.limits[kind]) * 100))
}

// Scans zählt man in Stück, Chat-Tokens sagen niemandem etwas: dort nur der Anteil in Worten
function usageText(kind: LimitKind): string {
  if (!usage.value)
    return ''
  if (kind === 'ocrPages')
    return `${formatNumber(usage.value.usage[kind])} / ${formatNumber(usage.value.limits[kind])}`
  const percent = usagePercent(kind)
  return `${percent < 1 ? 'unter 1' : percent} % genutzt`
}

// Import und Zwischenspeicher braucht fast niemand; eingeklappt schrecken sie nicht ab
const showAdvanced = ref(false)

async function refreshUsage(): Promise<void> {
  try {
    usage.value = await fetchUsage()
    usageError.value = ''
  }
  catch (e: any) {
    usageError.value = e.message
  }
}

async function upgrade(plan: string): Promise<void> {
  checkoutBusy.value = plan
  try {
    window.location.href = await startCheckout(plan)
  }
  catch (e: any) {
    toast.add({ severity: 'warn', summary: e.message, life: 5000 })
  }
  finally {
    checkoutBusy.value = null
  }
}

async function refreshCacheCount(): Promise<void> {
  try {
    const result = await db.queryOnce({ ocrcache: {} })
    ocrCacheCount.value = (result.data.ocrcache || []).length
  }
  catch {
    ocrCacheCount.value = 0
  }
}

onMounted(() => {
  refreshCacheCount()
  refreshUsage()
  vehiclesStore.load()
  reminders.load().catch(err => console.error('[settings] Erinnerungen laden', err))
})

async function handleExport(): Promise<void> {
  const json = await exportDatabase()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `wartungsheft-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  toast.add({ severity: 'success', summary: 'Daten exportiert', life: 3000 })
}

async function handleImport(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  try {
    const json = await file.text()
    const result = await importDatabase(json)
    toast.add({ severity: 'success', summary: `Import erfolgreich: ${importSummary(result.imported)}`, life: 5000 })
    await refreshCacheCount()
  }
  catch (e: any) {
    toast.add({ severity: 'error', summary: `Import fehlgeschlagen: ${e.message}`, life: 5000 })
  }
  input.value = ''
}

async function clearOcrCache(): Promise<void> {
  try {
    const result = await db.queryOnce({ ocrcache: {} })
    const entries = result.data.ocrcache || []
    if (entries.length) {
      await db.transact(entries.map((e: any) => tx.ocrcache[e.id].delete()))
    }
    ocrCacheCount.value = 0
    toast.add({ severity: 'success', summary: 'Scan-Zwischenspeicher geleert', life: 3000 })
  }
  catch {}
}

const themeOptions = [
  { label: 'Dunkel', value: 'dark' },
  { label: 'Hell', value: 'light' },
  { label: 'System', value: 'system' },
]

const currencyOptions = HOME_CURRENCIES.map(c => ({ label: c, value: c }))
</script>

<template>
  <main class="page-container">
    <h2 class="page-title">
      Einstellungen
    </h2>

    <Card class="settings-card">
      <template #title>
        Design
      </template>
      <template #content>
        <div class="form-field">
          <label>Farbschema</label>
          <Select
            v-model="settings.theme"
            :options="themeOptions"
            option-label="label"
            option-value="value"
            class="w-full"
          />
        </div>
      </template>
    </Card>

    <Card class="settings-card">
      <template #title>
        Währung
      </template>
      <template #content>
        <div class="form-field">
          <label for="home-currency">Heimwährung</label>
          <Select
            v-model="settings.homeCurrency"
            input-id="home-currency"
            :options="currencyOptions"
            option-label="label"
            option-value="value"
            class="w-full"
          />
          <small class="field-hint">Kostenübersicht und Exporte rechnen fremde Währungen zum EZB-Kurs am Rechnungsdatum in diese Währung um. Rechnungen behalten ihre Originalwährung.</small>
        </div>
      </template>
    </Card>

    <Card class="settings-card">
      <template #title>
        Erinnerungen
      </template>
      <template #content>
        <div class="form-field toggle-field">
          <ToggleSwitch
            :model-value="reminders.emailReminders"
            input-id="email-reminders"
            :disabled="!reminders.loaded"
            @update:model-value="toggleEmailReminders"
          />
          <label for="email-reminders">Fällige Wartungen per E-Mail</label>
        </div>
        <small class="field-hint">Eine E-Mail an deine Login-Adresse, sobald eine Arbeit bald fällig oder überfällig ist. Unveränderte Erinnerungen höchstens alle 30 Tage.</small>
      </template>
    </Card>

    <Card class="settings-card">
      <template #title>
        Abo & Nutzung
      </template>
      <template #content>
        <Message v-if="usageError" severity="error">
          {{ usageError }}
        </Message>
        <template v-else-if="usage">
          <div class="plan-line">
            <span>Aktueller Plan: <strong>{{ planName(currentPlan) }}</strong></span>
            <span class="plan-price">{{ planPrice(currentPlan) }}</span>
          </div>
          <Message v-if="trialNote" :severity="usage.trial?.active ? 'info' : 'warn'" :closable="false" class="trial-note">
            {{ trialNote }}
          </Message>
          <div v-for="kind in limitKinds" :key="kind" class="usage-row">
            <div class="usage-label">
              <span>{{ LIMIT_LABELS[kind] }}</span>
              <span>{{ usageText(kind) }}</span>
            </div>
            <ProgressBar :value="usagePercent(kind)" :show-value="false" style="height: 0.5rem" />
          </div>
          <div class="provider-info">
            Zähler gelten für {{ formatMonth(usage.month) }}. KI-Verarbeitung über Mistral (Frankreich, EU) ist im Abo enthalten, kein eigener API-Key nötig.
            Die Schwellen sind Fair Use gegen Missbrauch, kein Sparziel: normaler Gebrauch kommt nie in ihre Nähe.
          </div>
          <div v-if="business" class="business-subscription" data-testid="business-subscription">
            <div>
              <strong>Jahresabo {{ business.audience === 'privat' ? 'Privat' : 'Betrieb' }}</strong> ·
              {{ business.company || business.contact }} · {{ business.vehicles }}
              {{ business.vehicles === 1 ? 'Fahrzeug' : 'Fahrzeuge' }}
            </div>
            <div v-if="business.periodEnd">
              <template v-if="business.cancelAtPeriodEnd">
                Gekündigt, läuft bis {{ lastPaidDay(business.periodEnd) }}.
              </template>
              <template v-else>
                Läuft bis {{ lastPaidDay(business.periodEnd) }}, verlängert sich automatisch um ein Jahr.
              </template>
            </div>
            <div v-if="business.openInvoice" class="open-invoice">
              Rechnung {{ business.openInvoice.number }} über {{ formatCurrency(business.openInvoice.amount) }},
              zahlbar bis {{ formatDate(business.openInvoice.dueAt) }}. Die QR-Rechnung kam per Mail; fehlt sie, schreib an
              <a :href="`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Rechnung ${business.openInvoice.number}`)}`">{{ CONTACT_EMAIL }}</a>.
            </div>
            <Button
              v-if="business.cancelAtPeriodEnd"
              label="Kündigung zurücknehmen"
              size="small"
              outlined
              :loading="businessBusy"
              @click="changeBusinessPlan('resume')"
            />
            <Button
              v-else
              label="Abo kündigen"
              size="small"
              severity="secondary"
              outlined
              :loading="businessBusy"
              @click="changeBusinessPlan('cancel')"
            />
          </div>
          <div v-else-if="canOrderBusiness" class="business-order">
            <div>
              <strong>Privat:</strong> {{ formatCurrency(PRIVATE_YEARLY_CHF) }} im Jahr bis {{ PRIVATE_MAX_VEHICLES }} Fahrzeuge.
              <strong>Betrieb:</strong> {{ formatCurrency(BUSINESS_VEHICLE_YEARLY_CHF) }} pro Fahrzeug und Jahr,
              Rechnung auf die Firma. Beides zahlbar in 30 Tagen.
            </div>
            <Button label="Jahresabo bestellen" size="small" @click="orderOpen = true" />
          </div>
          <div v-else-if="billingEnabled && upgradePlans.length" class="upgrade-list">
            <div v-for="plan in upgradePlans" :key="plan.id" class="upgrade-row">
              <div>
                <strong>{{ planName(plan) }}</strong> · {{ planPrice(plan) }} ·
                {{ plan.maxVehicles ? `bis ${plan.maxVehicles} Fahrzeuge` : 'Rechnung auf die Firma' }}, Scannen ohne Limit im Alltag
              </div>
              <Button
                :label="`Auf ${planName(plan)} wechseln`"
                size="small"
                :loading="checkoutBusy === plan.id"
                @click="upgrade(plan.id)"
              />
            </div>
          </div>
          <div class="provider-info">
            Mehrere Fahrer? Mit einer Team-Adresse anmelden (z. B. fuhrpark@deinbetrieb.ch), jedes Handy einmal
            mit dem Code aus diesem Postfach. Dann fotografiert jeder mit demselben Zugang.
          </div>
        </template>
        <ProgressBar v-else mode="indeterminate" style="height: 0.5rem" />
      </template>
    </Card>

    <OrderDialog
      :visible="orderOpen"
      :active-vehicles="activeVehicleCount"
      :trial-ends-at="usage?.trial?.active ? usage.trial.endsAt : null"
      @close="orderOpen = false"
      @ordered="onOrdered"
    />

    <Card class="settings-card">
      <template #title>
        Daten
      </template>
      <template #content>
        <div class="button-group">
          <Button
            label="Daten exportieren"
            icon="pi pi-download"
            outlined
            class="export-btn"
            @click="handleExport"
          />
          <Button
            :label="showAdvanced ? 'Erweitert ausblenden' : 'Erweitert anzeigen'"
            :icon="showAdvanced ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
            text
            severity="secondary"
            @click="showAdvanced = !showAdvanced"
          />
        </div>

        <template v-if="showAdvanced">
          <div class="button-group advanced-section">
            <Button
              label="Daten importieren"
              icon="pi pi-upload"
              outlined
              class="import-btn"
              @click="importInput?.click()"
            />
            <input
              ref="importInput"
              type="file"
              accept=".json"
              style="display: none"
              @change="handleImport"
            >
          </div>

          <div class="cache-section">
            <Button
              label="Scan-Zwischenspeicher leeren"
              icon="pi pi-trash"
              outlined
              severity="danger"
              size="small"
              class="clear-cache-btn"
              @click="clearOcrCache"
            />
            <span class="cache-count">
              {{ ocrCacheCount }} gespeicherte Scans
            </span>
          </div>
        </template>
      </template>
    </Card>
  </main>
</template>

<style scoped>
.plan-line {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.plan-price {
  color: var(--p-text-muted-color);
}
.usage-row {
  margin-bottom: 0.75rem;
}
.usage-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
}
.upgrade-list {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.upgrade-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
.page-container {
  padding: 1rem;
  max-width: 800px;
  margin: 0 auto;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 500;
  margin: 0 0 1rem;
}

.settings-card {
  margin-bottom: 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 1rem;
}

.field-hint {
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
}

.toggle-field {
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.form-field label {
  font-size: 0.875rem;
  font-weight: 500;
}

.w-full {
  width: 100%;
}

.input-with-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.input-with-toggle .w-full {
  flex: 1;
}

.provider-info {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  margin-bottom: 0.5rem;
}

.provider-warning {
  margin-top: 0.5rem;
}

.business-subscription,
.business-order {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  margin: 0.75rem 0;
  padding: 0.75rem;
  border: 1px solid var(--p-surface-border);
  border-radius: var(--p-border-radius-md, 6px);
  font-size: 0.9rem;
  line-height: 1.45;
}

.open-invoice {
  color: var(--p-text-muted-color);
}

.button-group {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.advanced-section {
  margin-top: 1rem;
}

.cache-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
}

.cache-count {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}
</style>
