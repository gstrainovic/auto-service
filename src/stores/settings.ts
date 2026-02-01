import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type AiProvider = 'mistral' | 'anthropic' | 'openai' | 'meta-llama' | 'ollama'

export const useSettingsStore = defineStore('settings', () => {
  const aiProvider = ref<AiProvider>(
    (localStorage.getItem('ai_provider') as AiProvider)
    || (import.meta.env.VITE_AI_PROVIDER as AiProvider)
    || 'mistral',
  )
  const aiApiKey = ref(
    localStorage.getItem('ai_api_key')
    || import.meta.env.VITE_AI_API_KEY as string
    || '',
  )
  const aiModel = ref(
    localStorage.getItem('ai_model')
    || import.meta.env.VITE_AI_MODEL as string
    || '',
  )

  watch(aiProvider, v => localStorage.setItem('ai_provider', v))
  watch(aiApiKey, v => localStorage.setItem('ai_api_key', v))
  watch(aiModel, v => localStorage.setItem('ai_model', v))

  return { aiProvider, aiApiKey, aiModel }
})
