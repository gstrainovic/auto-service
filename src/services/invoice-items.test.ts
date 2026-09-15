import { describe, expect, it } from 'vitest'
import { itemsExceedTotal, maintenancesFromItems, repairItems } from './invoice-items'

describe('maintenancesFromItems', () => {
  it('liefert eine Wartung pro Kategorie, Beschreibungen verbunden, Reihenfolge wie auf der Rechnung', () => {
    expect(maintenancesFromItems([
      { description: 'Winterreifen montieren', category: 'reifen', amount: 30 },
      { description: 'Ölfilter', category: 'oelwechsel', amount: 20 },
      { description: 'Ventil', category: 'reifen', amount: 2.5 },
      { description: '', category: 'reifen', amount: 5 },
    ])).toEqual([
      { category: 'reifen', description: 'Winterreifen montieren, Ventil' },
      { category: 'oelwechsel', description: 'Ölfilter' },
    ])
  })
})

// Seestern-Garage, Quittung 8243 vom 05.01.2024: drei Beschreibungszeilen gehören zu einer Arbeitszeile
// (1.50 Std. × 130.00 = 195.00); die KI hängte den Betrag an jede Zeile
const seestern8243 = [
  { description: 'Auspuff reparieren', category: 'auspuff', amount: 195 },
  { description: 'Auto auf Ölverlust kontrollieren', category: 'sonstiges', amount: 195 },
  { description: 'Motor und Getriebe unten reinigen', category: 'sonstiges', amount: 195 },
  { description: 'Arbeit', category: 'sonstiges', amount: 195 },
  { description: 'Verbinder', category: 'sonstiges', amount: 54.6 },
  { description: 'Klein- & Reinigungs-Material', category: 'sonstiges', amount: 9.8 },
]

describe('repairItems', () => {
  it('fasst aufeinanderfolgende Positionen mit gleichem Betrag zusammen, wenn die Summe sonst über dem Total liegt', () => {
    const { items, repaired } = repairItems(seestern8243, 280.4)
    expect(repaired).toBe(true)
    expect(items).toEqual([
      { description: 'Arbeit: Auspuff reparieren, Auto auf Ölverlust kontrollieren, Motor und Getriebe unten reinigen', category: 'auspuff', amount: 195 },
      { description: 'Verbinder', category: 'sonstiges', amount: 54.6 },
      { description: 'Klein- & Reinigungs-Material', category: 'sonstiges', amount: 9.8 },
    ])
  })

  it('lässt stimmige Positionen unverändert, auch wenn zwei zufällig gleich teuer sind', () => {
    const items = [
      { description: 'Winterreifen links', category: 'reifen', amount: 110 },
      { description: 'Winterreifen rechts', category: 'reifen', amount: 110 },
      { description: 'Montage', category: 'reifen', amount: 30 },
    ]
    expect(repairItems(items, 270)).toEqual({ items, repaired: false })
  })

  it('bleibt beim Original, wenn auch das Zusammenfassen die Summe nicht passend macht', () => {
    const items = [
      { description: 'A', category: 'sonstiges', amount: 500 },
      { description: 'B', category: 'sonstiges', amount: 400 },
    ]
    expect(repairItems(items, 300)).toEqual({ items, repaired: false })
  })

  it('verbindet Beschreibungen ohne Sammelwort mit Komma und nimmt die Kategorie aus dem ganzen Text', () => {
    const items = [
      { description: 'Bremsbeläge vorne', category: 'sonstiges', amount: 240 },
      { description: 'Bremsscheiben prüfen', category: 'sonstiges', amount: 240 },
    ]
    expect(repairItems(items, 259.4).items).toEqual([
      { description: 'Bremsbeläge vorne, Bremsscheiben prüfen', category: 'bremsen', amount: 240 },
    ])
  })
})

describe('itemsExceedTotal', () => {
  it('meldet Positionen, die zusammen mehr als das Total ergeben (mit 1 Franken Toleranz)', () => {
    expect(itemsExceedTotal(seestern8243, 280.4)).toEqual({ itemsSum: 844.4, total: 280.4 })
    expect(itemsExceedTotal([{ amount: 280.9 }], 280.4)).toBeNull()
    expect(itemsExceedTotal([{ amount: 100 }], 0)).toBeNull()
    expect(itemsExceedTotal([], 280.4)).toBeNull()
  })
})
