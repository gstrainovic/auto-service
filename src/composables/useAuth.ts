import { readonly, ref } from 'vue'
import { db, instantConfig } from '../lib/instantdb'
import { forgetAccount, knownAccountEmail, rememberAccount } from '../lib/known-account'

interface AuthUser {
  id: string
  email?: string | null
}

const user = ref<AuthUser | null>(null)
const isLoading = ref(true)
/** Zuletzt auf diesem Gerät angemeldete E-Mail, bleibt nach dem Abmelden (`lib/known-account.ts`) */
const knownEmail = ref<string | null>(knownAccountEmail())

/** Name des Google-OAuth-Clients im Instant-Dashboard (Auth → Google) */
export const GOOGLE_CLIENT_NAME = 'google-web'

// Promise das resolved wenn Auth-State zum ersten Mal bekannt ist
let authReadyResolve: () => void
const authReady = new Promise<void>((resolve) => {
  authReadyResolve = resolve
})

// E2E-Tests: Auth-Bypass nur im lokalen Modus (kein Magic Code nötig), nie bei cloud/selfhosted
const isLocal = instantConfig.authBypass
const LOCAL_USER_ID = 'e2e-test-user'
// Lokaler Modus: Abmelden merkt sich der Browser, damit sich der abgemeldete Zustand testen lässt
const LOCAL_SIGNED_OUT = 'auth:localSignedOut'

function setUser(u: AuthUser | null) {
  user.value = u
  if (u?.email) {
    rememberAccount(u.email)
    knownEmail.value = knownAccountEmail()
  }
}

// Einmalig subscriben (Singleton)
let initialized = false
function initAuth() {
  if (initialized)
    return
  initialized = true

  if (isLocal) {
    // Lokaler Modus (E2E-Tests): Sofort als Test-User authentifizieren, ausser nach «Abmelden»
    if (localStorage.getItem(LOCAL_SIGNED_OUT) !== '1')
      setUser({ id: LOCAL_USER_ID, email: 'test@e2e.local' })
    isLoading.value = false
    authReadyResolve()
    return
  }

  db.subscribeAuth((auth: any) => {
    setUser(auth.user ?? null)
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
    if (isLocal)
      return
    await db.auth.sendMagicCode({ email })
  }

  async function signInWithMagicCode(email: string, code: string) {
    if (isLocal) {
      localStorage.removeItem(LOCAL_SIGNED_OUT)
      setUser({ id: LOCAL_USER_ID, email })
      return
    }
    await db.auth.signInWithMagicCode({ email, code })
  }

  function signOut() {
    if (isLocal) {
      localStorage.setItem(LOCAL_SIGNED_OUT, '1')
      setUser(null)
      return
    }
    db.auth.signOut()
  }

  /** «Andere E-Mail» auf der Login-Seite: das Gerät gilt danach wieder als unbekannt */
  function forgetKnownAccount() {
    forgetAccount()
    knownEmail.value = null
  }

  /**
   * Google-Login über den Redirect-Flow von InstantDB: Link auf /runtime/oauth/start des eigenen Backends,
   * Google authentifiziert, das Backend legt die Session an und leitet auf redirectURL zurück.
   * Der Client heisst im Instant-Dashboard (Auth → Google) `google-web`.
   */
  function googleAuthUrl(): string {
    return db.auth.createAuthorizationURL({
      clientName: GOOGLE_CLIENT_NAME,
      redirectURL: `${window.location.origin}/dashboard`,
    })
  }

  return {
    user: readonly(user),
    isLoading: readonly(isLoading),
    knownEmail: readonly(knownEmail),
    authReady,
    sendMagicCode,
    signInWithMagicCode,
    signOut,
    forgetKnownAccount,
    googleAuthUrl,
  }
}
