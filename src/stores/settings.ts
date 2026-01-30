import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type AiProvider = 'google' | 'anthropic' | 'openai' | 'ollama'

export const useSettingsStore = defineStore('settings', () => {
  const aiProvider = ref<AiProvider>(
    (localStorage.getItem('ai_provider') as AiProvider) || 'google',
  )
  const aiApiKey = ref(localStorage.getItem('ai_api_key') || '')
  const ollamaUrl = ref(localStorage.getItem('ollama_url') || 'http://localhost:11434')
  const ollamaModel = ref(localStorage.getItem('ollama_model') || 'qwen2-vl')

  watch(aiProvider, v => localStorage.setItem('ai_provider', v))
  watch(aiApiKey, v => localStorage.setItem('ai_api_key', v))
  watch(ollamaUrl, v => localStorage.setItem('ollama_url', v))
  watch(ollamaModel, v => localStorage.setItem('ollama_model', v))

  return { aiProvider, aiApiKey, ollamaUrl, ollamaModel }
})
