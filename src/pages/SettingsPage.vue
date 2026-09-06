<script setup lang="ts">
import { LIMIT_LABELS, PLANS } from '@strainovic/ai-proxy/plans'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Message from 'primevue/message'
import ProgressBar from 'primevue/progressbar'
import Select from 'primevue/select'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref } from 'vue'
import { db, tx } from '../lib/instantdb'
import { fetchUsage, startCheckout } from '../services/ai-access'
import { exportDatabase, importDatabase } from '../services/db-export'
import { useSettingsStore } from '../stores/settings'

type UsageInfo = Awaited<ReturnType<typeof fetchUsage>>
type LimitKind = keyof typeof LIMIT_LABELS

const settings = useSettingsStore()
const toast = useToast()
const ocrCacheCount = ref(0)
const importInput = ref<HTMLInputElement | null>(null)

// Abo & Nutzung (über den AI-Proxy)
const usage = ref<UsageInfo | null>(null)
const usageError = ref('')
const checkoutBusy = ref<string | null>(null)
const currentPlan = computed(() => PLANS[usage.value?.plan ?? 'free'])
const upgradePlans = computed(() => Object.values(PLANS).filter(p => p.priceChfPerMonth > currentPlan.value.priceChfPerMonth))
const limitKinds = Object.keys(LIMIT_LABELS) as LimitKind[]

function formatNumber(n: number): string {
  return new Intl.NumberFormat('de-CH').format(n)
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
})

async function handleExport(): Promise<void> {
  const json = await exportDatabase()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `auto-service-backup-${new Date().toISOString().slice(0, 10)}.json`
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
    const summary = Object.entries(result.imported)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')
    toast.add({ severity: 'success', summary: `Import erfolgreich - ${summary}`, life: 5000 })
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
        Abo & Nutzung
      </template>
      <template #content>
        <Message v-if="usageError" severity="error">
          {{ usageError }}
        </Message>
        <template v-else-if="usage">
          <div class="plan-line">
            <span>Aktueller Plan: <strong>{{ currentPlan.name }}</strong></span>
            <span class="plan-price">{{ currentPlan.priceChfPerMonth }} CHF/Monat</span>
          </div>
          <div v-for="kind in limitKinds" :key="kind" class="usage-row">
            <div class="usage-label">
              <span>{{ LIMIT_LABELS[kind] }}</span>
              <span>{{ formatNumber(usage.usage[kind]) }} / {{ formatNumber(usage.limits[kind]) }}</span>
            </div>
            <ProgressBar :value="usagePercent(kind)" :show-value="false" style="height: 0.5rem" />
          </div>
          <div class="provider-info">
            Zähler gelten für den Monat {{ usage.month }}. KI-Verarbeitung über Mistral (Frankreich, EU) ist im Abo enthalten, kein eigener API-Key nötig.
          </div>
          <div v-if="upgradePlans.length" class="upgrade-list">
            <div v-for="plan in upgradePlans" :key="plan.id" class="upgrade-row">
              <div>
                <strong>{{ plan.name }}</strong> · {{ plan.priceChfPerMonth }} CHF/Monat ·
                {{ formatNumber(plan.limits.ocrPages) }} Scans, {{ formatNumber(plan.limits.chatTokens) }} Chat-Tokens
              </div>
              <Button
                :label="`Upgrade auf ${plan.name}`"
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
            {{ ocrCacheCount }} Eintrage im Cache
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
