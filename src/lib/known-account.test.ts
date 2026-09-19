import { describe, expect, it } from 'vitest'
import { authEntry, forgetAccount, knownAccountEmail, rememberAccount } from './known-account'

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const map = new Map<string, string>()
  return {
    getItem: k => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v) },
    removeItem: (k) => { map.delete(k) },
  }
}

const brokenStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
  getItem: () => { throw new Error('SecurityError') },
  setItem: () => { throw new Error('QuotaExceededError') },
  removeItem: () => { throw new Error('SecurityError') },
}

describe('authEntry', () => {
  it('eingeloggt führt in die App', () => {
    expect(authEntry({ loggedIn: true, knownEmail: null })).toBe('app')
    expect(authEntry({ loggedIn: true, knownEmail: 'a@b.ch' })).toBe('app')
  })

  it('abgemeldet, aber Konto auf diesem Gerät bekannt: Anmelden', () => {
    expect(authEntry({ loggedIn: false, knownEmail: 'a@b.ch' })).toBe('login')
  })

  it('unbekanntes Gerät: Testzeit', () => {
    expect(authEntry({ loggedIn: false, knownEmail: null })).toBe('trial')
  })
})

describe('bekanntes Konto im Browser', () => {
  it('merkt sich die E-Mail über das Abmelden hinaus', () => {
    const s = memoryStorage()
    expect(knownAccountEmail(s)).toBeNull()
    rememberAccount('kunde@example.ch', s)
    expect(knownAccountEmail(s)).toBe('kunde@example.ch')
  })

  it('überschreibt beim Anmelden mit einer anderen Adresse', () => {
    const s = memoryStorage()
    rememberAccount('alt@example.ch', s)
    rememberAccount('neu@example.ch', s)
    expect(knownAccountEmail(s)).toBe('neu@example.ch')
  })

  it('ignoriert leere Adressen', () => {
    const s = memoryStorage()
    rememberAccount('', s)
    rememberAccount(null, s)
    rememberAccount('   ', s)
    expect(knownAccountEmail(s)).toBeNull()
  })

  it('vergisst die Adresse auf Wunsch', () => {
    const s = memoryStorage()
    rememberAccount('kunde@example.ch', s)
    forgetAccount(s)
    expect(knownAccountEmail(s)).toBeNull()
  })

  it('gesperrter Speicher (Inkognito, blockierte Website-Daten) wirft nicht', () => {
    expect(() => rememberAccount('kunde@example.ch', brokenStorage)).not.toThrow()
    expect(() => forgetAccount(brokenStorage)).not.toThrow()
    expect(knownAccountEmail(brokenStorage)).toBeNull()
  })
})
