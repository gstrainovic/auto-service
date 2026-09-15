/**
 * Entscheidung, wie ein fotografierter Beleg gedreht wird. Getrennt von der Bildverarbeitung (useImageResize.ts,
 * Tesseract OSD im Browser), damit die Regel ohne Canvas testbar ist.
 */
export interface OrientationInput {
  width: number
  height: number
  /** von Tesseract OSD erkannter Drehwinkel im Uhrzeigersinn, 0 wenn aufrecht oder unbekannt */
  degrees: 0 | 90 | 180 | 270
  /** orientation_confidence von Tesseract; null wenn keine Angabe */
  confidence: number | null
}

/** Ab dieser Sicherheit wird ein Hochformat-Beleg gedreht; darunter ist ein aufrechtes Foto wahrscheinlicher als ein Fehler */
export const PORTRAIT_MIN_CONFIDENCE = 2

/**
 * `expectPortrait`: Rechnungen sind fast immer Hochformat, ein quer liegendes Foto ist also gedreht (Standard).
 * Der Fahrzeugausweis ist aufgeklappt quer; dort nur nach sicher erkanntem Winkel drehen.
 */
export function rotationFor({ width, height, degrees, confidence }: OrientationInput, opts: { expectPortrait?: boolean } = {}): 0 | 90 | 180 | 270 {
  if (width > height && opts.expectPortrait !== false)
    return degrees === 0 ? 90 : degrees
  // sonst nur bei sicher erkanntem Winkel drehen (z. B. auf dem Kopf stehend fotografiert)
  if (degrees !== 0 && (confidence ?? 0) >= PORTRAIT_MIN_CONFIDENCE)
    return degrees
  return 0
}
