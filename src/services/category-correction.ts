/**
 * Regelbasierte Kategorie-Korrektur: überschreibt die KI-Zuordnung, wenn eindeutige Stichworte in der Beschreibung
 * stehen (z. B. «Auspuff reparieren» → auspuff statt sonstiges). Reihenfolge zählt: der erste Treffer gewinnt.
 * Genutzt vom Chat (add_invoice, add_maintenance) und vom Rechnungsformular (Scan).
 */
const CATEGORY_KEYWORDS: [RegExp, string][] = [
  [/auspuff|katalysator|kr[üu]mmer|abgasanlage|endtopf|mitteltopf/i, 'auspuff'],
  [/k[üu]hl(wasser|er|mittel|fl[üu]ssigkeit)|frostschutz|thermostat|unterdruck/i, 'kuehlung'],
  [/windschutzscheibe|frontscheibe|heckscheibe|autoglas|scheibenwischer/i, 'autoglas'],
  [/[öo]lwechsel|[öo]lfilter|motor[öo]l|[öo]lablassschraube/i, 'oelwechsel'],
  [/bremsbe[lä]|bremsscheib|bremss[aä]ttel|bremstrommel|bremsbacke/i, 'bremsen'],
  [/\breifen\b|reifenmontage|reifenwechsel|auswuchten|winterreifen|sommerreifen/i, 'reifen'],
  [/feder(bein)?|sto[ßs]d[äa]mpfer|radlager|achse|lenkung|querlenker|spurstange|traggelenk/i, 'fahrwerk'],
  [/batterie|lichtmaschine|starter|z[üu]ndkerze|z[üu]ndspule/i, 'elektrik'],
  [/lack|karosserie|rost|delle|unfallschaden|blech/i, 'karosserie'],
  [/inspektion|service(?!.*heft)|durchsicht|(hu|mfk).vorbereitung/i, 'inspektion'],
  [/klimaanlage|klima.service|k[äa]ltemittel/i, 'klimaanlage'],
  [/zahnriemen|steuerriemen|steuerkette/i, 'zahnriemen'],
  [/bremsfl[üu]ssigkeit/i, 'bremsflüssigkeit'],
  [/luftfilter|pollenfilter|innenraumfilter/i, 'luftfilter'],
  [/t[üu]v\b|hauptuntersuchung|\bhu\b|\bau\b|\bmfk\b|motorfahrzeugkontrolle|strassenverkehrsamt|\bstva\b/i, 'tuev'],
]

export function correctCategory(description: string, aiCategory: string): string {
  const desc = description.toLowerCase()
  for (const [pattern, category] of CATEGORY_KEYWORDS) {
    if (pattern.test(desc))
      return category
  }
  return aiCategory
}
