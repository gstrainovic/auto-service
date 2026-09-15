/** Wartungskategorien, einzige Liste. Ohne Abhängigkeiten, damit reine Module und Tests sie importieren können. */
export const MAINTENANCE_CATEGORIES = [
  'oelwechsel',
  'inspektion',
  'bremsen',
  'reifen',
  'luftfilter',
  'zahnriemen',
  'bremsflüssigkeit',
  'klimaanlage',
  'tuev',
  'karosserie',
  'elektrik',
  'fahrwerk',
  'auspuff',
  'kuehlung',
  'autoglas',
  'sonstiges',
] as const

export type MaintenanceCategory = typeof MAINTENANCE_CATEGORIES[number]
