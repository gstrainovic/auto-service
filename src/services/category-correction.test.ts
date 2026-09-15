import { describe, expect, it } from 'vitest'
import { correctCategory } from './category-correction'

describe('correctCategory', () => {
  it('überschreibt die KI-Kategorie bei eindeutigen Stichworten', () => {
    expect(correctCategory('Auspuff reparieren', 'sonstiges')).toBe('auspuff')
    expect(correctCategory('Motoröl 5W-30', 'inspektion')).toBe('oelwechsel')
    expect(correctCategory('MFK-Vorbereitung', 'tuev')).toBe('inspektion')
    expect(correctCategory('Motorfahrzeugkontrolle Strassenverkehrsamt', 'sonstiges')).toBe('tuev')
  })

  it('lässt die KI-Kategorie ohne Stichwort stehen', () => {
    expect(correctCategory('Lieferspesen', 'sonstiges')).toBe('sonstiges')
    expect(correctCategory('Arbeit gemäss Auftrag', 'inspektion')).toBe('inspektion')
  })
})
