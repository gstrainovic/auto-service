import { describe, expect, it } from 'vitest'
import { leadSchema } from './leads'

describe('leadSchema', () => {
  it('akzeptiert E-Mail und Segment, schneidet Leerraum ab', () => {
    const result = leadSchema.parse({ email: '  hans@muster.ch ', segment: 'betrieb', note: '' })
    expect(result).toEqual({ email: 'hans@muster.ch', segment: 'betrieb', note: '' })
  })

  it('lehnt ungültige E-Mail ab', () => {
    expect(() => leadSchema.parse({ email: 'keine-adresse', segment: 'betrieb' })).toThrow()
  })

  it('kennt nur die Segmente betrieb und privathalter', () => {
    expect(() => leadSchema.parse({ email: 'a@b.ch', segment: 'garage' })).toThrow()
    expect(leadSchema.parse({ email: 'a@b.ch', segment: 'privathalter' }).segment).toBe('privathalter')
  })

  it('begrenzt die Notiz auf 500 Zeichen', () => {
    expect(() => leadSchema.parse({ email: 'a@b.ch', segment: 'betrieb', note: 'x'.repeat(501) })).toThrow()
  })
})
