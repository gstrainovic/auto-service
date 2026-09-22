import { describe, expect, it } from 'vitest'
import { hidePrerendered, markPrerendered, PRERENDER_PATHS, prerenderFile } from './prerender'

describe('seiten zum Vorrendern', () => {
  it('sind die öffentlichen Einstiegsseiten', () => {
    expect(PRERENDER_PATHS).toEqual(['/', '/privathalter', '/betrieb', '/hilfe'])
  })
})

describe('prerenderFile', () => {
  it('legt die Startseite nach index.html, die anderen in ihren Ordner', () => {
    expect(prerenderFile('/')).toBe('index.html')
    expect(prerenderFile('/privathalter')).toBe('privathalter/index.html')
  })
})

describe('markPrerendered', () => {
  it('schreibt die Adresse als erstes Element in den Kopf', () => {
    const html = '<html><head><title>T</title></head><body><div id="app"><h1>X</h1></div></body></html>'
    expect(markPrerendered(html, '/betrieb'))
      .toBe('<html><head><meta name="prerendered-path" content="/betrieb" /><title>T</title></head><body><div id="app"><h1>X</h1></div></body></html>')
  })

  it('übernimmt keine Klassen vom Render-Browser am html-Element (Design wählt main.ts pro Besucher)', () => {
    const html = '<html lang="de" class="dark-mode prerender-hidden"><head></head></html>'
    expect(markPrerendered(html, '/')).toBe('<html lang="de"><head><meta name="prerendered-path" content="/" /></head></html>')
  })

  it('ersetzt eine alte Markierung statt eine zweite anzuhängen', () => {
    const html = '<html><head><meta name="prerendered-path" content="/" /><meta name="prerendered-path" content="/" /><title>T</title></head></html>'
    expect(markPrerendered(html, '/hilfe')).toBe('<html><head><meta name="prerendered-path" content="/hilfe" /><title>T</title></head></html>')
  })
})

describe('hidePrerendered', () => {
  it('zeigt den Inhalt, wenn er zur Adresse passt und niemand angemeldet war', () => {
    expect(hidePrerendered('/privathalter', '/privathalter', false)).toBe(false)
    expect(hidePrerendered('/privathalter', '/privathalter/', false)).toBe(false)
    expect(hidePrerendered('/', '/', false)).toBe(false)
  })

  it('versteckt die Landing Page, wenn die App eine andere Seite startet', () => {
    expect(hidePrerendered('/', '/dashboard', false)).toBe(true)
    expect(hidePrerendered('/', '/vehicles/123', false)).toBe(true)
  })

  it('versteckt sie auch für bekannte Konten, die gleich ins Dashboard springen', () => {
    expect(hidePrerendered('/', '/', true)).toBe(true)
  })

  it('zeigt Angebotsseiten auch bekannten Konten sofort, dort leitet niemand weiter', () => {
    expect(hidePrerendered('/betrieb', '/betrieb', true)).toBe(false)
  })

  it('lässt ungerenderte Seiten in Ruhe', () => {
    expect(hidePrerendered(null, '/dashboard', true)).toBe(false)
  })
})
