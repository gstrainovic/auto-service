// Bekanntes Konto auf diesem Gerät: Magic Code und Google legen Konten beim ersten Anmelden an, darum
// gibt es kein getrenntes Registrieren. Damit Kunden nach dem Abmelden nicht «30 Tage gratis testen» sehen,
// merkt sich der Browser die zuletzt angemeldete E-Mail (localStorage, bleibt nach dem Abmelden).
// Ohne Speicher (Inkognito, blockierte Website-Daten) gilt das Gerät als unbekannt.

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const KEY = 'auth:knownEmail'

/** Was der Einstieg auf öffentlichen Seiten anbietet: in die App, Anmelden oder die Testzeit */
export type AuthEntry = 'app' | 'login' | 'trial'

export function authEntry({ loggedIn, knownEmail }: { loggedIn: boolean, knownEmail: string | null }): AuthEntry {
  if (loggedIn)
    return 'app'
  return knownEmail ? 'login' : 'trial'
}

function browserStorage(): KeyValueStorage | undefined {
  return typeof localStorage === 'undefined' ? undefined : localStorage
}

export function rememberAccount(email: string | null | undefined, storage = browserStorage()) {
  const value = email?.trim()
  if (!value)
    return
  try {
    storage?.setItem(KEY, value)
  }
  catch {}
}

export function knownAccountEmail(storage = browserStorage()): string | null {
  try {
    return storage?.getItem(KEY) || null
  }
  catch {
    return null
  }
}

export function forgetAccount(storage = browserStorage()) {
  try {
    storage?.removeItem(KEY)
  }
  catch {}
}
