import { readonly, ref } from 'vue'
import { db } from '../lib/instantdb'

interface AuthUser {
  id: string
  email?: string | null
}

const user = ref<AuthUser | null>(null)
const isLoading = ref(true)

// Promise das resolved wenn Auth-State zum ersten Mal bekannt ist
let authReadyResolve: () => void
const authReady = new Promise<void>((resolve) => {
  authReadyResolve = resolve
})

// E2E-Tests: Auth-Bypass im lokalen Modus (kein Magic Code nötig)
const isLocal = import.meta.env.VITE_INSTANTDB_MODE === 'local'

// Einmalig subscriben (Singleton)
let initialized = false
function initAuth() {
  if (initialized)
    return
  initialized = true

  if (isLocal) {
    // Lokaler Modus (E2E-Tests): Sofort als Test-User authentifizieren
    user.value = { id: 'e2e-test-user', email: 'test@e2e.local' }
    isLoading.value = false
    authReadyResolve()
    return
  }

  db.subscribeAuth((auth: any) => {
    user.value = auth.user ?? null
    isLoading.value = false
    authReadyResolve()
  })
}

// Hilfsfunktion für Stores/Services — gibt aktuelle User-ID oder wirft
export function getCurrentUserId(): string {
  if (!user.value)
    throw new Error('Not authenticated')
  return user.value.id
}

export function useAuth() {
  initAuth()

  async function sendMagicCode(email: string) {
    await db.auth.sendMagicCode({ email })
  }

  async function signInWithMagicCode(email: string, code: string) {
    await db.auth.signInWithMagicCode({ email, code })
  }

  function signOut() {
    db.auth.signOut()
  }

  return {
    user: readonly(user),
    isLoading: readonly(isLoading),
    authReady,
    sendMagicCode,
    signInWithMagicCode,
    signOut,
  }
}
