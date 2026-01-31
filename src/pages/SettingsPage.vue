<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '../stores/settings'

const settings = useSettingsStore()
const showKey = ref(false)

const providerOptions = [
  { label: 'OpenRouter (Gemini 2.0 Flash)', value: 'openrouter' },
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
          OpenRouter nutzt Gemini 2.0 Flash — schnell, Vision + Chat, kein Quota-Limit.
        </div>
      </q-card-section>
    </q-card>
  </q-page>
</template>
