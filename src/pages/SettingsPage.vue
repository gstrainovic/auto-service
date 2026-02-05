<script setup lang="ts">
import Button from 'primevue/button'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref } from 'vue'
import { db, tx } from '../lib/instantdb'
import { exportDatabase, importDatabase } from '../services/db-export'
import { useSettingsStore } from '../stores/settings'

const settings = useSettingsStore()
const toast = useToast()
const showKey = ref(false)
const ocrCacheCount = ref(0)
const importInput = ref<HTMLInputElement | null>(null)

async function refreshCacheCount(): Promise<void> {
  try {
    const result = await db.queryOnce({ ocrcache: {} })
    ocrCacheCount.value = (result.data.ocrcache || []).length
  }
  catch {
    ocrCacheCount.value = 0
  }
}

onMounted(() => refreshCacheCount())

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

const defaultModels: Record<string, string> = {
  'mistral': 'mistral-small-latest',
  'anthropic': 'claude-sonnet-4-20250514',
  'openai': 'gpt-4o-mini',
  'meta-llama': 'meta-llama/llama-4-maverick',
  'ollama': 'qwen3-vl:2b',
}

const defaultModel = computed(() => defaultModels[settings.aiProvider] || '')

const providerOptions = [
  { label: 'Mistral (mistral-small-latest)', value: 'mistral' },
  { label: 'Anthropic Claude', value: 'anthropic' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'Meta Llama 4 Maverick (via OpenRouter)', value: 'meta-llama' },
  { label: 'Ollama lokal (qwen3-vl:2b) - 100% privat', value: 'ollama' },
]

const providerInfo = computed(() => {
  switch (settings.aiProvider) {
    case 'mistral':
      return {
        text: 'Mistral Small - schnell, Chat + Tool Calling. Direkte Mistral-API.',
        warn: true,
        warnText: 'Mistral Free Tier (Experiment Plan): Deine Daten werden standardmassig fur Modell-Training verwendet. Opt-out in den Mistral-Kontoeinstellungen moglich.',
      }
    case 'anthropic':
      return {
        text: 'Claude Sonnet - Vision + Chat + Tool Calling. API-Daten werden nicht fur Training verwendet.',
        warn: false,
        warnText: '',
      }
    case 'openai':
      return {
        text: 'GPT-4o Mini - Chat + Tool Calling. API-Daten werden seit Marz 2023 nicht fur Training verwendet.',
        warn: false,
        warnText: '',
      }
    case 'meta-llama':
      return {
        text: 'Llama 4 Maverick - Vision + Chat + Tool Calling (via OpenRouter).',
        warn: true,
        warnText: 'Meta Llama: API-Daten werden nicht fur Training verwendet, aber multimodale Modelle (Vision) sind in der EU rechtlich eingeschrankt.',
      }
    case 'ollama':
      return {
        text: 'qwen3-vl:2b - Vision + Chat + Tool Calling, 100% lokal. Ollama muss auf localhost:11434 laufen. Kein API-Key notig.',
        warn: false,
        warnText: '',
      }
    default:
      return { text: '', warn: false, warnText: '' }
  }
})
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
        KI-Provider
      </template>
      <template #content>
        <div class="form-field">
          <label>Provider</label>
          <Select
            v-model="settings.aiProvider"
            :options="providerOptions"
            option-label="label"
            option-value="value"
            class="w-full"
          />
        </div>

        <div class="form-field">
          <label>API Key</label>
          <div class="input-with-toggle">
            <InputText
              v-model="settings.aiApiKey"
              :type="showKey ? 'text' : 'password'"
              class="w-full"
            />
            <Button
              :icon="showKey ? 'pi pi-eye-slash' : 'pi pi-eye'"
              text
              @click="showKey = !showKey"
            />
          </div>
        </div>

        <div class="form-field">
          <label>Model (leer = Standard)</label>
          <InputText
            v-model="settings.aiModel"
            :placeholder="defaultModel"
            class="w-full"
          />
        </div>

        <div class="provider-info">
          {{ providerInfo.text }}
        </div>

        <Message v-if="providerInfo.warn" severity="warn" class="provider-warning">
          <template #icon>
            <i class="pi pi-exclamation-triangle" />
          </template>
          {{ providerInfo.warnText }}
        </Message>
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
