import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type AiProvider = 'mistral' | 'anthropic' | 'openai' | 'meta-llama' | 'ollama'
export type ThemeMode = 'dark' | 'light' | 'system'

function applyTheme(mode: ThemeMode): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = mode === 'dark' || (mode === 'system' && prefersDark)
  document.documentElement.classList.toggle('dark-mode', isDark)
}

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<ThemeMode>(
    (localStorage.getItem('theme') as ThemeMode) || 'dark',
  )
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

  watch(theme, (v) => {
    localStorage.setItem('theme', v)
    applyTheme(v)
  }, { immediate: true })

  // Bei 'system': auf OS-Wechsel reagieren
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', () => {
    if (theme.value === 'system')
      applyTheme('system')
  })

  watch(aiProvider, v => localStorage.setItem('ai_provider', v))
  watch(aiApiKey, v => localStorage.setItem('ai_api_key', v))
  watch(aiModel, v => localStorage.setItem('ai_model', v))

  return { theme, aiProvider, aiApiKey, aiModel }
})
