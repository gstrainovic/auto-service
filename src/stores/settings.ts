import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type AiProvider = 'openrouter' | 'anthropic' | 'openai' | 'mistral' | 'meta-llama' | 'ollama'

export const useSettingsStore = defineStore('settings', () => {
  const aiProvider = ref<AiProvider>(
    (localStorage.getItem('ai_provider') as AiProvider) || 'openrouter',
  )
  const aiApiKey = ref(localStorage.getItem('ai_api_key') || '')

  watch(aiProvider, v => localStorage.setItem('ai_provider', v))
  watch(aiApiKey, v => localStorage.setItem('ai_api_key', v))

  return { aiProvider, aiApiKey }
})
