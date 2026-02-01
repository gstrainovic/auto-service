<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSettingsStore } from '../stores/settings'

const settings = useSettingsStore()
const showKey = ref(false)

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
  { label: 'Ollama lokal (qwen3-vl:2b) — 100% privat', value: 'ollama' },
]

const providerInfo = computed(() => {
  switch (settings.aiProvider) {
    case 'mistral':
      return { text: 'Mistral Small — schnell, Chat + Tool Calling. Direkte Mistral-API.', warn: true, warnText: 'Mistral Free Tier (Experiment Plan): Deine Daten werden standardmäßig für Modell-Training verwendet. Opt-out in den Mistral-Kontoeinstellungen möglich.' }
    case 'anthropic':
      return { text: 'Claude Sonnet — Vision + Chat + Tool Calling. API-Daten werden nicht für Training verwendet.', warn: false, warnText: '' }
    case 'openai':
      return { text: 'GPT-4o Mini — Chat + Tool Calling. API-Daten werden seit März 2023 nicht für Training verwendet.', warn: false, warnText: '' }
    case 'meta-llama':
      return { text: 'Llama 4 Maverick — Vision + Chat + Tool Calling (via OpenRouter).', warn: true, warnText: 'Meta Llama: API-Daten werden nicht für Training verwendet, aber multimodale Modelle (Vision) sind in der EU rechtlich eingeschränkt.' }
    case 'ollama':
      return { text: 'qwen3-vl:2b — Vision + Chat + Tool Calling, 100% lokal. Ollama muss auf localhost:11434 laufen. Kein API-Key nötig.', warn: false, warnText: '' }
    default:
      return { text: '', warn: false, warnText: '' }
  }
})
</script>

<template>
  <q-page padding>
    <h5>Einstellungen</h5>

    <q-card class="q-mb-md">
      <q-card-section>
        <div class="text-h6">
          KI-Provider
        </div>
      </q-card-section>
      <q-card-section>
        <q-select
          v-model="settings.aiProvider"
          :options="providerOptions"
          label="Provider"
          outlined
          emit-value
          map-options
        />
        <q-input
          v-model="settings.aiApiKey"
          label="API Key"
          outlined
          :type="showKey ? 'text' : 'password'"
          class="q-mt-md"
        >
          <template #append>
            <q-icon
              :name="showKey ? 'visibility_off' : 'visibility'"
              class="cursor-pointer"
              @click="showKey = !showKey"
            />
          </template>
        </q-input>
        <q-input
          v-model="settings.aiModel"
          label="Model (leer = Standard)"
          outlined
          class="q-mt-md"
          :placeholder="defaultModel"
        />
        <div class="text-caption q-mt-sm text-grey">
          {{ providerInfo.text }}
        </div>
        <q-banner
          v-if="providerInfo.warn"
          class="q-mt-sm bg-warning text-dark"
          rounded
          dense
        >
          <template #avatar>
            <q-icon
              name="warning"
              color="dark"
            />
          </template>
          {{ providerInfo.warnText }}
        </q-banner>
      </q-card-section>
    </q-card>
  </q-page>
</template>
