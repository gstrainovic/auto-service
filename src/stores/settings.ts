import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { DEFAULT_CURRENCY } from '../lib/locale'

export type ThemeMode = 'dark' | 'light' | 'system'

/** Währungen, in die Kostenübersicht und Exporte umrechnen können (EZB-Kurse, siehe services/fx.ts). */
export const HOME_CURRENCIES = ['CHF', 'EUR'] as const
export type HomeCurrency = typeof HOME_CURRENCIES[number]

function applyTheme(mode: ThemeMode): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = mode === 'dark' || (mode === 'system' && prefersDark)
  document.documentElement.classList.toggle('dark-mode', isDark)
}

function readHomeCurrency(): HomeCurrency {
  const stored = localStorage.getItem('homeCurrency')
  return (HOME_CURRENCIES as readonly string[]).includes(stored ?? '') ? stored as HomeCurrency : DEFAULT_CURRENCY as HomeCurrency
}

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<ThemeMode>(
    (localStorage.getItem('theme') as ThemeMode) || 'dark',
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

  // Heimwährung: Nutzereinstellung über dem Deploy-Standard (CHF); Rechnungen behalten ihre Originalwährung
  const homeCurrency = ref<HomeCurrency>(readHomeCurrency())
  watch(homeCurrency, v => localStorage.setItem('homeCurrency', v))

  return { theme, homeCurrency }
})
