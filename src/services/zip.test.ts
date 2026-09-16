import { describe, expect, it } from 'vitest'
import { createZip } from './zip'

const text = (s: string) => new TextEncoder().encode(s)

describe('createZip', () => {
  it('schreibt ein gültiges ZIP mit allen Dateien', () => {
    const zip = createZip([
      { name: 'kosten.csv', data: text('Jahr;Betrag\n2026;100.00\n') },
      { name: 'belege/rechnung.txt', data: text('Beleg') },
    ])
    const bytes = new Uint8Array(zip)
    // lokaler Datei-Header PK\x03\x04
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4B, 0x03, 0x04])
    const dump = new TextDecoder().decode(bytes)
    expect(dump).toContain('kosten.csv')
    expect(dump).toContain('belege/rechnung.txt')
    expect(dump).toContain('Jahr;Betrag')
    // zentrales Verzeichnis PK\x01\x02 zweimal, Ende PK\x05\x06 einmal
    expect(dump.split('PK').length - 1).toBe(2)
    expect(dump.split('PK').length - 1).toBe(1)
  })

  it('kommt mit Umlauten im Dateinamen und leeren Dateien zurecht', () => {
    const zip = createZip([{ name: 'belege/öl-wechsel.txt', data: new Uint8Array() }])
    expect(zip.byteLength).toBeGreaterThan(50)
    expect(new TextDecoder().decode(zip)).toContain('öl-wechsel.txt')
  })
})
