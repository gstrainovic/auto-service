<script setup lang="ts">
import type { LimitKind, Plan } from '@strainovic/ai-proxy/plans'
import { PLANS } from '@strainovic/ai-proxy/plans'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Message from 'primevue/message'
import ProgressBar from 'primevue/progressbar'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref } from 'vue'
import { userMessage } from '../lib/errors'
import { db, tx } from '../lib/instantdb'
import { formatCurrency, formatMonth, formatNumber } from '../lib/locale'
import { fetchUsage, startCheckout } from '../services/ai-access'
import { exportDatabase, importDatabase } from '../services/db-export'
import { useRemindersStore } from '../stores/reminders'
import { HOME_CURRENCIES, useSettingsStore } from '../stores/settings'

type UsageInfo = Awaited<ReturnType<typeof fetchUsage>>

// Nutzertexte für die Zähler und die Plan-Namen des Katalogs
const LIMIT_LABELS: Record<LimitKind, string> = {
  ocrPages: 'Scans',
  chatTokens: 'Chat-Kontingent',
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
const CONTACT_EMAIL = 'info@strainovic-it.ch'

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
const currentPlan = computed(() => PLANS[usage.value?.plan ?? 'free'])
const upgradePlans = computed(() => Object.values(PLANS).filter(p => p.priceChfPerMonth > currentPlan.value.priceChfPerMonth))
const limitKinds = Object.keys(LIMIT_LABELS) as LimitKind[]

function planName(plan: Plan): string {
  return plan.id === 'free' ? 'Gratis' : plan.name
}

function planPrice(plan: Plan): string {
  return `${formatCurrency(plan.priceChfPerMonth)} / Monat`
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
    toast.add({ severity: 'success', summary: 'OCR-Cache geleert', life: 3000 })
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
          <div v-for="kind in limitKinds" :key="kind" class="usage-row">
            <div class="usage-label">
              <span>{{ LIMIT_LABELS[kind] }}</span>
              <span>{{ formatNumber(usage.usage[kind]) }} / {{ formatNumber(usage.limits[kind]) }}</span>
            </div>
            <ProgressBar :value="usagePercent(kind)" :show-value="false" style="height: 0.5rem" />
          </div>
          <div class="provider-info">
            Zähler gelten für {{ formatMonth(usage.month) }}. KI-Verarbeitung über Mistral (Frankreich, EU) ist im Abo enthalten, kein eigener API-Key nötig.
          </div>
          <div v-if="!billingEnabled" class="provider-info">
            Mehr Kontingent oder ein Abo für den Betrieb? Schreib uns an
            <a :href="`mailto:${CONTACT_EMAIL}`">{{ CONTACT_EMAIL }}</a>, wir richten es ein und stellen eine Jahresrechnung.
          </div>
          <div v-else-if="upgradePlans.length" class="upgrade-list">
            <div v-for="plan in upgradePlans" :key="plan.id" class="upgrade-row">
              <div>
                <strong>{{ planName(plan) }}</strong> · {{ planPrice(plan) }} ·
                {{ formatNumber(plan.limits.ocrPages) }} Scans, Chat-Kontingent {{ formatNumber(plan.limits.chatTokens) }}
              </div>
              <Button
                :label="`Auf ${planName(plan)} wechseln`"
                size="small"
                :loading="checkoutBusy === plan.id"
                @click="upgrade(plan.id)"
              />
            </div>
          </div>
        </template>
        <ProgressBar v-else mode="indeterminate" style="height: 0.5rem" />
      </template>
    </Card>

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
            label="OCR-Cache leeren"
            icon="pi pi-trash"
            outlined
            severity="danger"
            size="small"
            class="clear-cache-btn"
            @click="clearOcrCache"
          />
          <span class="cache-count">
            {{ ocrCacheCount }} Einträge im Cache
          </span>
        </div>
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

.button-group {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
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
