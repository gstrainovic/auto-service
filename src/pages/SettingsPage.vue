<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '../stores/settings'

const settings = useSettingsStore()
const showKey = ref(false)

const providerOptions = [
  { label: 'Ollama (lokal, kostenlos)', value: 'ollama' },
  { label: 'Google Gemini (kostenlos)', value: 'google' },
  { label: 'Anthropic Claude', value: 'anthropic' },
  { label: 'OpenAI', value: 'openai' },
]
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
        <div class="text-caption q-mt-sm text-grey">
          Google Gemini hat ein kostenloses Free Tier (15 Anfragen/Minute).
        </div>
      </q-card-section>
    </q-card>

    <q-card v-if="settings.aiProvider === 'ollama'" class="q-mb-md">
      <q-card-section>
        <div class="text-h6">
          Ollama (Lokal)
        </div>
      </q-card-section>
      <q-card-section>
        <q-input
          v-model="settings.ollamaUrl"
          label="Ollama URL"
          outlined
          hint="Standard: http://localhost:11434"
        />
        <q-input
          v-model="settings.ollamaModel"
          label="Modell"
          outlined
          hint="z.B. qwen2-vl, moondream, llama3.2-vision"
          class="q-mt-md"
        />
        <div class="text-caption q-mt-sm text-grey">
          Installiere Ollama und lade ein Vision-Modell: ollama pull qwen2-vl
        </div>
      </q-card-section>
    </q-card>
  </q-page>
</template>
