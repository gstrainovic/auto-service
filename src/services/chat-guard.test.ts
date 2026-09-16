import { describe, expect, it } from 'vitest'
import { claimsActionWithoutTool } from './chat-guard'

// Mistral behauptet gern «eingetragen», ohne das schreibende Tool aufzurufen; nur Lese-Tools zählen nicht
describe('claimsActionWithoutTool', () => {
  const claim = '✅ Wartung für den **VW Golf** eingetragen:\n- **Ölwechsel** am 15.06.2025 bei 52.000 km.'

  it('erkennt die Behauptung, wenn nur ein Lese-Tool lief', () => {
    expect(claimsActionWithoutTool({ text: claim, steps: [{ toolCalls: [{ toolName: 'list_vehicles' }] }] })).toBe(true)
  })

  it('lässt die Behauptung durch, wenn ein schreibendes Tool lief', () => {
    expect(claimsActionWithoutTool({ text: claim, steps: [{ toolCalls: [{ toolName: 'list_vehicles' }] }, { toolCalls: [{ toolName: 'add_maintenance' }] }] })).toBe(false)
  })

  it('erkennt Sätze mit Hilfsverb ohne Tool', () => {
    expect(claimsActionWithoutTool({ text: 'Die Wartung wurde eingetragen.', steps: [] })).toBe(true)
  })

  it('lässt Rückfragen durch', () => {
    expect(claimsActionWithoutTool({ text: 'Soll ich den Ölwechsel am 15.06.2025 eintragen?', steps: [] })).toBe(false)
    expect(claimsActionWithoutTool({ text: 'Für welches Fahrzeug, den VW Golf oder den Porsche Cayenne?', steps: [] })).toBe(false)
  })

  it('lässt die Vorschau nach einer Bildanalyse durch (sonst würde add_invoice ohne Bestätigung erzwungen)', () => {
    const preview = 'Ich habe folgende Daten erfasst:\n- ✅ Werkstatt: Garage Muster\n- ✅ Betrag: CHF 250.00\n\nPasst das so?'
    expect(claimsActionWithoutTool({ text: preview, steps: [{ toolCalls: [{ toolName: 'scan_document' }] }] })).toBe(false)
    expect(claimsActionWithoutTool({ text: preview, steps: [] })).toBe(false)
  })
})
