import { describe, expect, it, vi } from 'vitest'
import { userMessage } from './errors'

describe('userMessage', () => {
  it('meldet das Monatslimit bei 402 oder «limit»', () => {
    expect(userMessage(Object.assign(new Error('Payment Required'), { statusCode: 402 }))).toBe('Monatslimit erreicht. Upgrade in den Einstellungen.')
    expect(userMessage(new Error('HTTP 402'))).toBe('Monatslimit erreicht. Upgrade in den Einstellungen.')
    expect(userMessage(new Error('Monthly limit exceeded'))).toBe('Monatslimit erreicht. Upgrade in den Einstellungen.')
  })

  it('lässt die deutsche Limit-Meldung des Proxys unverändert durch', () => {
    const proxy = 'Monatslimit erreicht: 500000 Chat-Tokens im Plan Gratis. Upgrade in den Einstellungen.'
    expect(userMessage(Object.assign(new Error(proxy), { statusCode: 402 }))).toBe(proxy)
  })

  it('bittet bei 429 um Geduld', () => {
    expect(userMessage(Object.assign(new Error('Too many'), { status: 429 }))).toBe('Zu viele Anfragen, bitte kurz warten.')
    expect(userMessage(new Error('Rate limit 429'))).toBe('Zu viele Anfragen, bitte kurz warten.')
  })

  it('erkennt Netzwerkfehler', () => {
    expect(userMessage(new TypeError('Failed to fetch'))).toBe('Keine Verbindung. Bitte Internet prüfen.')
    expect(userMessage(new Error('fetch failed'))).toBe('Keine Verbindung. Bitte Internet prüfen.')
    expect(userMessage(new Error('NetworkError when attempting to fetch resource.'))).toBe('Keine Verbindung. Bitte Internet prüfen.')
    expect(userMessage(new Error('The device is offline'))).toBe('Keine Verbindung. Bitte Internet prüfen.')
  })

  it('verlangt bei 401 und 403 eine neue Anmeldung', () => {
    expect(userMessage(Object.assign(new Error('Unauthorized'), { statusCode: 401 }))).toBe('Bitte neu anmelden.')
    expect(userMessage(new Error('Forbidden (403)'))).toBe('Bitte neu anmelden.')
  })

  it('gibt sonst eine allgemeine Meldung und loggt die Details', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(userMessage(new Error('TypeError: x is not a function'))).toBe('Das hat nicht geklappt. Bitte nochmals versuchen.')
    expect(userMessage('kaputt')).toBe('Das hat nicht geklappt. Bitte nochmals versuchen.')
    expect(userMessage(undefined)).toBe('Das hat nicht geklappt. Bitte nochmals versuchen.')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
