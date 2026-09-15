import { describe, expect, it } from 'vitest'
import { rotationFor } from './orientation'

describe('rotationFor', () => {
  it('dreht Querformat wie bisher: ohne Erkennung um 90°, sonst um den erkannten Winkel', () => {
    expect(rotationFor({ width: 1600, height: 1200, degrees: 0, confidence: 0 })).toBe(90)
    expect(rotationFor({ width: 1600, height: 1200, degrees: 270, confidence: 3 })).toBe(270)
  })

  it('dreht Hochformat nur bei sicher erkanntem Winkel, z. B. auf dem Kopf stehend', () => {
    expect(rotationFor({ width: 1200, height: 1600, degrees: 180, confidence: 4 })).toBe(180)
    expect(rotationFor({ width: 1200, height: 1600, degrees: 90, confidence: 2.5 })).toBe(90)
  })

  it('dreht querformatige Dokumente wie den Fahrzeugausweis nur bei sicher erkanntem Winkel', () => {
    expect(rotationFor({ width: 2430, height: 1698, degrees: 0, confidence: 5 }, { expectPortrait: false })).toBe(0)
    expect(rotationFor({ width: 2430, height: 1698, degrees: 180, confidence: 3 }, { expectPortrait: false })).toBe(180)
    expect(rotationFor({ width: 2430, height: 1698, degrees: 90, confidence: 0.5 }, { expectPortrait: false })).toBe(0)
  })

  it('lässt Hochformat bei aufrechtem Text oder unsicherer Erkennung unverändert', () => {
    expect(rotationFor({ width: 1200, height: 1600, degrees: 0, confidence: 5 })).toBe(0)
    expect(rotationFor({ width: 1200, height: 1600, degrees: 180, confidence: 0.4 })).toBe(0)
    expect(rotationFor({ width: 1200, height: 1600, degrees: 180, confidence: null })).toBe(0)
  })
})
