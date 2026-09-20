import type { AiAccess } from './ai-access'
import type { PageKind } from './invoice-scan'
import { createMistral } from '@ai-sdk/mistral'
import { generateObject } from 'ai'
import { z } from 'zod'
import { getCurrentUserId } from '../composables/useAuth'
import { db, id, tx } from '../lib/instantdb'
import { MAINTENANCE_CATEGORIES } from './categories'
import { mergePdfPages } from './invoice-scan'

export { MAINTENANCE_CATEGORIES }
export type { MaintenanceCategory } from './categories'

const invoiceSchema = z.object({
  workshopName: z.string().describe('Name der Werkstatt'),
  date: z.string().describe('Datum der Arbeit im Format YYYY-MM-DD: Reparatur- oder Leistungsdatum, falls angegeben, sonst Rechnungsdatum'),
  totalAmount: z.number().describe('Gesamtbetrag (brutto, inkl. MwSt.)'),
  currency: z.string().describe('Währung: CHF, EUR, USD etc.'),
  mileageAtService: z.number().nullable().optional().describe('Kilometerstand bei Reparatur falls angegeben, null wenn nicht vorhanden'),
  licensePlate: z.string().nullable().optional().describe('Kennzeichen des Fahrzeugs (z.B. SG 218574, M-AB 1234). NICHT die Fahrgestellnummer/VIN.'),
  vin: z.string().nullable().optional().describe('Fahrgestellnummer/VIN (17-stellig, beginnt meist mit W, V, oder ähnlich)'),
  items: z.array(z.object({
    description: z.string().describe('Beschreibung der Arbeit oder des Teils'),
    category: z.enum(MAINTENANCE_CATEGORIES).describe(
      'Kategorie: oelwechsel, bremsen, reifen, inspektion, luftfilter, zahnriemen, bremsflüssigkeit, klimaanlage, tuev, karosserie, fahrwerk, auspuff, kuehlung, autoglas, elektrik, sonstiges',
    ),
    amount: z.number().describe('Einzelbetrag dieser Position (nicht die Zwischensumme oder Gesamtsumme)'),
  })),
})

export type ParsedInvoice = z.infer<typeof invoiceSchema>

const vehicleDocumentSchema = z.object({
  documentType: z.string().describe('Art des Dokuments: fahrzeugausweis, kaufvertrag, fahrzeugschein, sonstiges'),
  make: z.string().describe('Marke des Fahrzeugs (Schweizer Fahrzeugausweis: erster Teil von Feld 21 «Marke und Typ»)'),
  model: z.string().describe('Modell/Typ (Fahrzeugausweis: Rest von Feld 21, z. B. «SAURER 3 DUX» → Modell «3 DUX»)'),
  year: z.number().describe('Vierstelliges Jahr der 1. Inverkehrsetzung (Fahrzeugausweis Feld 36, «03.64» → 1964), sonst Baujahr'),
  vin: z.string().nullable().optional().describe('Fahrgestellnummer (Fahrzeugausweis Feld 23) wie gedruckt, bei neueren Fahrzeugen 17-stellige VIN'),
  plate: z.string().nullable().optional().describe('Kontrollschild (Fahrzeugausweis Feld 15, z. B. «SG 218574»); steht nur das Kantonskürzel, nur dieses'),
  mileage: z.number().nullable().optional().describe('Kilometerstand, auch aus Vermerken (Fahrzeugausweis Feld 13/14, z. B. «KM-STAND: 405260»)'),
  engineType: z.string().nullable().optional().describe('Motortyp: Diesel, Benzin, Elektro, Hybrid'),
  enginePower: z.string().nullable().optional().describe('Leistung z.B. 140 kW / 190 PS'),
  purchaseDate: z.string().nullable().optional().describe('Kaufdatum im Format YYYY-MM-DD'),
  purchasePrice: z.number().nullable().optional().describe('Kaufpreis (Währung wie im Dokument, sonst CHF)'),
})

export type ParsedVehicleDocument = z.infer<typeof vehicleDocumentSchema>

const serviceBookSchema = z.object({
  entries: z.array(z.object({
    // alles ausser der Struktur tolerant: ein leeres Feld darf nicht die ganze Seite verwerfen
    date: z.string().nullable().optional().describe('Datum im Format YYYY-MM-DD'),
    mileage: z.number().nullable().optional().describe('Kilometerstand, weglassen wenn nicht eingetragen'),
    workshopName: z.string().nullable().optional().describe('Name der Werkstatt'),
    items: z.array(z.object({
      description: z.string().describe('Beschreibung der Arbeit'),
      // bewusst kein Enum: eine unbekannte Art würde sonst die ganze Seite verwerfen; die Auswertung filtert
      category: z.string().describe(`Kategorie, genau eine aus: ${MAINTENANCE_CATEGORIES.join(', ')}`),
    })).optional(),
  })),
  manufacturerIntervals: z.array(z.object({
    type: z.string().describe(`Wartungsart, genau eine aus: ${MAINTENANCE_CATEGORIES.join(', ')}`),
    label: z.string().optional().describe('Bezeichnung wie im Heft, z. B. «Motoröl + Ölfilter»'),
    intervalKm: z.number().describe('Intervall in km, 0 wenn nur zeitbasiert'),
    intervalMonths: z.number().describe('Intervall in Monaten, 0 wenn nur km-basiert'),
  })).optional().describe('Hersteller-Wartungsintervalle falls auf der Seite sichtbar'),
})

export type ParsedServiceBook = z.infer<typeof serviceBookSchema>

export const DEFAULT_MODEL = 'mistral-small-latest'

interface ModelOptions {
  access: AiAccess
  model?: string
}

export function getModel(opts: ModelOptions) {
  const { baseURL, apiKey, headers } = opts.access
  return createMistral({ apiKey, baseURL, headers })(opts.model || DEFAULT_MODEL)
}

export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 4): Promise<T> {
  let lastError: any
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    }
    catch (e: any) {
      lastError = e
      const msg = e.message || ''
      const isRateLimit = msg.includes('429') || msg.includes('Rate limit') || msg.includes('RESOURCE_EXHAUSTED') || e.statusCode === 429
      if (!isRateLimit || attempt === maxRetries)
        break
      const waitMs = [5000, 15000, 30000, 60000][attempt] ?? 60000
      console.warn(`Rate limit — warte ${waitMs / 1000}s (Versuch ${attempt + 1}/${maxRetries})`)
      await new Promise(r => setTimeout(r, waitMs))
    }
  }
  throw lastError
}

/**
 * In-Memory-Cache für OCR-Ergebnisse: SHA-256-Hash des Bildes → Markdown-Text.
 * Verhindert doppelte OCR-Aufrufe für dasselbe Bild (z.B. bei Tests, Retry, Phase 1 + scan_document).
 */
const ocrCache = new Map<string, string>()

export async function hashImage(base64: string): Promise<string> {
  const data = new TextEncoder().encode(base64)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

interface OcrPage {
  markdown?: string
  header?: string
  footer?: string
  tables?: { id: string, content: string }[]
}

/**
 * Ruft die Mistral OCR API auf und gibt den extrahierten Markdown-Text zurück.
 * Nutzt /v1/ocr statt /v1/chat/completions — spezialisiertes OCR-Modell mit
 * perfekter Tabellen- und Spaltenstruktur-Erkennung.
 * Ergebnisse werden per SHA-256-Hash gecacht (In-Memory).
 */
export interface OcrResult {
  markdown: string
  cacheId: string
}

export async function callMistralOcr(imageBase64: string, access: AiAccess): Promise<OcrResult> {
  const hash = await hashImage(imageBase64)

  // 1. In-Memory-Cache (schnellste Stufe)
  const memCached = ocrCache.get(hash)
  if (memCached) {
    return { markdown: memCached, cacheId: hash }
  }

  // 2. InstantDB-Cache (persistente Stufe)
  // InstantDB verlangt UUIDs als Entity-IDs, daher hash als Feld speichern
  try {
    const result = await db.queryOnce({ ocrcache: {} })
    const ocrEntries = result.data.ocrcache || []
    const cached = ocrEntries.find((o: any) => o.hash === hash)
    if (cached) {
      ocrCache.set(hash, cached.markdown)
      return { markdown: cached.markdown, cacheId: hash }
    }
  }
  catch (e) {
    // Ohne Verbindung gibt es keinen Cache-Treffer; das ist kein Fehler, der Scan läuft trotzdem
    console.warn('[OCR] Cache nicht abfragbar:', e)
  }

  const resp = await fetch(`${access.baseURL}/ocr`, {
    method: 'POST',
    headers: {
      ...access.headers,
      'Authorization': `Bearer ${access.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'mistral-ocr-latest',
      document: {
        type: 'image_url',
        image_url: imageBase64.startsWith('/9j/') ? `data:image/jpeg;base64,${imageBase64}` : `data:image/webp;base64,${imageBase64}`,
      },
      table_format: 'markdown',
    }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(`Mistral OCR error ${resp.status}: ${(err as any).error?.message || resp.statusText}`)
  }

  const data = await resp.json() as { pages?: OcrPage[] }
  const text = data.pages?.map((p) => {
    let md = p.markdown || ''
    // Tabellen-Platzhalter durch echten Inhalt ersetzen
    if (p.tables?.length) {
      for (const tbl of p.tables)
        md = md.replace(`[${tbl.id}](${tbl.id})`, tbl.content)
    }
    return md
  }).join('\n\n') || ''

  ocrCache.set(hash, text)

  // In InstantDB persistieren (UUID als Entity-ID, hash als Feld)
  try {
    const entityId = id()
    await db.transact([tx.ocrcache[entityId].update({ hash, markdown: text, creatorId: getCurrentUserId(), createdAt: Date.now() })])
  }
  catch (e) {
    console.error('[OCR] InstantDB cache write failed:', e)
  }

  return { markdown: text, cacheId: hash }
}

/**
 * Ruft die Mistral OCR API für ein PDF-Dokument auf.
 * Gibt ein Array von Markdown-Texten zurück (einer pro Seite).
 * Mistral OCR: max 50 MB Dateigröße, max 1000 Seiten.
 */
export async function callMistralOcrPdf(pdfBase64: string, access: AiAccess): Promise<string[]> {
  const resp = await fetch(`${access.baseURL}/ocr`, {
    method: 'POST',
    headers: {
      ...access.headers,
      'Authorization': `Bearer ${access.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'mistral-ocr-latest',
      document: {
        type: 'document_url',
        document_url: `data:application/pdf;base64,${pdfBase64}`,
      },
      table_format: 'markdown',
    }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(`Mistral OCR PDF error ${resp.status}: ${(err as any).error?.message || resp.statusText}`)
  }

  const data = await resp.json() as { pages?: OcrPage[] }
  return (data.pages || []).map((p) => {
    let md = p.markdown || ''
    if (p.tables?.length) {
      for (const tbl of p.tables)
        md = md.replace(`[${tbl.id}](${tbl.id})`, tbl.content)
    }
    return md
  })
}

/**
 * Zwei-Stufen-Pipeline für Mistral: OCR → Chat
 * Stufe 1: mistral-ocr-latest extrahiert Text perfekt (inkl. Tabellen)
 * Stufe 2: Chat-Modell parst den OCR-Text in strukturiertes JSON (ohne Bild)
 *
 * Getestet vs. document_annotation_format (Ein-Stufen): Document Annotation
 * halluziniert massiv bei Rechnungen (erfindet Beträge, falsche Kategorien).
 * 2-Stufen ist zuverlässiger weil das Chat-Modell nur den OCR-Text sieht.
 */
async function parseWithOcrPipeline<T>(
  imageBase64: string,
  access: AiAccess,
  schema: z.ZodType<T>,
  prompt: string,
  modelId?: string,
): Promise<T> {
  const { markdown: ocrText } = await withRetry(() => callMistralOcr(imageBase64, access))
  return parseOcrText(ocrText, access, schema, prompt, modelId)
}

/** Stufe 2 allein: bereits erkannten OCR-Text (z. B. aus einem PDF) in das Schema überführen */
async function parseOcrText<T>(
  ocrText: string,
  access: AiAccess,
  schema: z.ZodType<T>,
  prompt: string,
  modelId?: string,
): Promise<T> {
  const model = getModel({ access, model: modelId })

  const { object } = await withRetry(() => generateObject({
    model,
    maxRetries: 0,
    temperature: 0,
    schema,
    messages: [{
      role: 'user',
      content: `${prompt}\n\n--- OCR-TEXT DES DOKUMENTS ---\n${ocrText}`,
    }],
  }))

  return object as T
}

const INVOICE_PROMPT = `Analysiere diese Werkstattrechnung sorgfältig.

WICHTIG — Kennzeichen vs. Fahrgestellnummer:
- Kennzeichen (license plate): Kürzel + Zahlen, z.B. "SG 218574", "M-AB 1234", "B-CD 5678". Steht oft neben dem Fahrzeugnamen.
- Fahrgestellnummer/VIN: 17 Zeichen, beginnt mit W, V, etc. z.B. "WP1ZZZ9PZ8LA14872"
- "SG 218574" ist ein SCHWEIZER KENNZEICHEN (Kanton St. Gallen), NICHT eine Fahrgestellnummer!

WICHTIG — Datum:
- Das Wartungsheft braucht den Tag der Arbeit. Steht ein "Reparaturdatum", "Leistungsdatum" oder "Auftrag vom", nimm dieses.
- Nur wenn es fehlt, das Rechnungs- oder Quittungsdatum ("Nr. 8431 vom 23.08.2024").

WICHTIG — Positionen extrahieren:
- Lies die Tabellenspalten korrekt: Beschreibung | Menge | Einheit | Preis | Betrag
- Der "Betrag" pro Position = Menge × Einzelpreis
- Unterscheide ARBEITSKOSTEN (Stunden × Stundensatz) von MATERIALKOSTEN (Teile)
- Textzeilen OHNE eigene Menge und OHNE eigenen Betrag sind Beschreibung der NÄCHSTEN Zeile mit Betrag. Beispiel:
    "Auspuff reparieren" / "Auto auf Oelverlust kontrollieren" / "Arbeit 1.50 Std. 130.00 195.00"
  → EINE Position: description "Arbeit: Auspuff reparieren, Auto auf Oelverlust kontrollieren", amount 195.00.
  Den Betrag NIE auf jede Beschreibungszeile wiederholen.
- "Summe Arbeiten" und "Summe Teile" sind Zwischensummen — KEINE eigenen Positionen
- Klein- & Reinigungs-Material und Lieferspesen sind eigene Positionen
- Kontrolliere: Die Summe aller Positions-Beträge muss ungefähr dem Netto-Gesamtbetrag (vor MwSt.) entsprechen

WICHTIG — Währung:
- "CHF", "Fr." oder "Totalbetrag CHF" → Währung ist CHF
- Nur bei ausdrücklichem "€", "EUR" oder "Euro" → Währung ist EUR
- Ohne Angabe → Währung ist CHF

WICHTIG — Kategorien richtig zuordnen:
- Federn, Stossdämpfer, Federbeine, Achse, Lenkung, Radlager → fahrwerk
- Auspuff, Krümmer, Katalysator, Abgasanlage → auspuff
- Kühlwasser, Kühler, Thermostat, Frostschutz, Unterdruckleitung → kuehlung
- Windschutzscheibe, Autoglas, Scheibenwischer → autoglas
- Ölwechsel, Ölfilter, Motoröl → oelwechsel
- Bremsen, Bremsbeläge, Bremsscheiben → bremsen
- Reifen montieren, Reifenwechsel, Auswuchten → reifen
- Karosserie, Blech, Lack, Rost → karosserie

WICHTIG — Beträge als Zahlen:
- "1 014.80" → 1014.80 (Leerzeichen entfernen)
- "540,00" → 540.00 (Komma als Dezimaltrenner bei EUR)
- Felder die nicht auf der Rechnung stehen → weglassen (nicht null setzen)

Extrahiere alle Daten. Antworte auf Deutsch.`

export async function parseInvoice(
  imageBase64: string,
  access: AiAccess,
  modelId?: string,
): Promise<ParsedInvoice> {
  return parseWithOcrPipeline(imageBase64, access, invoiceSchema, INVOICE_PROMPT, modelId)
}

/**
 * Rechnung aus gesprochenem Text: dieselbe zweite Stufe wie beim Foto, nur kommt der Text aus dem Diktat statt
 * aus der OCR. Im Test traf dieser Weg alle fünf Felder, während das Audio-Modell direkt den Werkstattnamen
 * verhörte (`stt-vergleich.md`).
 */
export async function parseInvoiceFromSpeech(
  gesprochen: string,
  access: AiAccess,
  modelId?: string,
): Promise<ParsedInvoice> {
  return parseOcrText(`Diktat einer Werkstattrechnung:\n${gesprochen}`, access, invoiceSchema, INVOICE_PROMPT, modelId)
}

const invoicePageSchema = invoiceSchema.extend({
  kind: z.enum(['rechnung', 'fortsetzung', 'andere']).describe(
    'rechnung: Seite mit eigenem Rechnungskopf (Werkstatt, Rechnungsnummer oder Datum). fortsetzung: setzt die Rechnung der vorherigen Seite fort (Übertrag, Seite 2, Abrechnungsdetails derselben Werkstatt). andere: keine Rechnung (AGB, leere Seite, Werbung).',
  ),
})

export type ParsedPdfInvoice = ParsedInvoice & { pages: number[] }

const INVOICE_PAGE_PROMPT = `Dies ist EINE Seite aus einem PDF, das EINE oder MEHRERE Werkstattrechnungen enthalten kann.
Werte NUR diese Seite aus. Werkstatt, Datum und Betrag stammen ausschliesslich von dieser Seite, nie von der vorherigen.
Die vorherige Seite ist nur als Hilfe angegeben, um zu entscheiden, ob diese Seite eine Fortsetzung ist.
Fehlt auf einer Fortsetzungsseite ein Wert (Datum, Werkstatt, Gesamtbetrag), leeren Text bzw. 0 angeben.

${INVOICE_PROMPT}`

/** Seiten gleichzeitig auswerten, aber nicht alle auf einmal (Rate-Limit des Proxys) */
const PAGE_CONCURRENCY = 3

/**
 * Rechnungen aus einem PDF: alle Seiten per OCR lesen, dann jede Seite einzeln auswerten und Fortsetzungen
 * zusammenführen (mergePdfPages). Ein Aufruf für das ganze PDF liess bei 9 Seiten Rechnungen aus und übertrug die
 * Werkstatt der ersten Rechnung auf alle.
 */
export async function parseInvoicesPdf(
  pdfBase64: string,
  access: AiAccess,
  modelId?: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ invoices: ParsedPdfInvoice[], pages: number }> {
  const texts = await withRetry(() => callMistralOcrPdf(pdfBase64, access))
  const results: { page: number, kind: PageKind, parsed: ParsedInvoice }[] = Array.from({ length: texts.length })
  let next = 0
  let done = 0
  async function worker() {
    while (next < texts.length) {
      const i = next++
      const previous = i > 0 ? `\n\n--- VORHERIGE SEITE (nur zur Einordnung, gekürzt) ---\n${texts[i - 1]!.slice(0, 1200)}` : ''
      const { kind, ...parsed } = await parseOcrText(`${texts[i]}${previous}`, access, invoicePageSchema, INVOICE_PAGE_PROMPT, modelId)
      results[i] = { page: i + 1, kind, parsed }
      onProgress?.(++done, texts.length)
    }
  }
  await Promise.all(Array.from({ length: Math.min(PAGE_CONCURRENCY, texts.length) }, worker))
  return { invoices: mergePdfPages(results), pages: texts.length }
}

const VEHICLE_DOC_PROMPT = `Analysiere dieses Fahrzeugdokument (Schweizer Fahrzeugausweis, Kaufvertrag, deutscher Fahrzeugschein oder Zulassungsbescheinigung). Extrahiere die Fahrzeugdaten. Antworte auf Deutsch.

Schweizer Fahrzeugausweis: Die Felder sind nummeriert und viersprachig beschriftet (Deutsch, Französisch, Italienisch, Rätoromanisch).
- 15 Schild/Plaque: Kontrollschild. 21 Marke und Typ. 23 Fahrgestell-Nr. 36 1. Inverkehrsetzung (Monat.Jahr, zweistelliges Jahr vierstellig ergänzen).
- 18 Stammnummer und 24 Typengenehmigung sind NICHT die Fahrgestellnummer.
- Halter (Name, Wohnort) gehört nicht zu den Fahrzeugdaten.
- Kilometerstand steht nur in Vermerken (13/14), wenn überhaupt; sonst weglassen.`

export async function parseVehicleDocument(
  imageBase64: string,
  access: AiAccess,
  modelId?: string,
): Promise<ParsedVehicleDocument> {
  return parseWithOcrPipeline(imageBase64, access, vehicleDocumentSchema, VEHICLE_DOC_PROMPT, modelId)
}

/** Fahrzeugdokument als PDF: alle Seiten per OCR, gemeinsam auswerten (Ausweis und Kaufvertrag sind kurz) */
export async function parseVehicleDocumentPdf(
  pdfBase64: string,
  access: AiAccess,
  modelId?: string,
): Promise<ParsedVehicleDocument> {
  const pages = await withRetry(() => callMistralOcrPdf(pdfBase64, access))
  const text = pages.map((t, i) => `--- Seite ${i + 1} ---\n${t}`).join('\n\n')
  return parseOcrText(text, access, vehicleDocumentSchema, VEHICLE_DOC_PROMPT, modelId)
}

const SERVICE_BOOK_PROMPT = `Analysiere diese Serviceheft-Seite(n). Antworte auf Deutsch.

WARTUNGSEINTRÄGE (Stempel, handschriftliche Zeilen):
- Ein Kasten ist ein Eintrag. Datum, Kilometerstand, Auftragsnummer, Stempel und Kreuze gehören zum selben Kasten; nie Werte aus verschiedenen Kästen mischen.
- Zweistellige Jahre vierstellig ergänzen. Unleserliche Werte weglassen statt raten, den Kilometerstand lieber leer lassen.
- Die Kilometerstände steigen mit dem Datum. Passt ein gelesener Wert nicht dazu, nochmals genau hinschauen.
- Leere oder durchgestrichene Kästen weglassen.
- Seiten ohne Stempel und ohne handschriftliches Datum (Wartungsplan, Checkliste, Inhaltsverzeichnis) liefern KEINE Einträge. Nie einen Eintrag aus einer Checkliste bauen.

HERSTELLER-INTERVALLE:
- Nur Arbeiten mit ausdrücklich genanntem eigenem Intervall («alle 30'000 km», «alle 2 Jahre», «Kleine Wartung bei 30.000, 90.000 … km»).
- Punkte aus der Checkliste einer Wartung (prüfen, Sichtprüfung, nachstellen) sind KEIN eigenes Intervall. Im Zweifel weglassen.
- Zahlenreihen meinen den Abstand: «bei 30.000, 90.000, 150.000 km» ist ein Abstand von 60.000 km. Wechseln sich kleine und grosse Wartung ab, zählt für inspektion der Abstand von einer Wartung zur nächsten (im Beispiel 30.000 km und 2 Jahre).
- Nie dasselbe Intervall über viele Arten streuen. Schweizer Apostroph als Tausendertrennzeichen lesen, Jahre in Monate umrechnen.

Typische Zuordnung: Service/Kleine und Große Wartung → inspektion, Motoröl/Ölfilter → oelwechsel, Zündkerzen → elektrik, Keilriemen/Zahnriemen → zahnriemen, Kühlmittel → kuehlung, MFK/HU → tuev, Getriebeöl → sonstiges.`

export async function parseServiceBook(
  imageBase64: string,
  access: AiAccess,
  modelId?: string,
): Promise<ParsedServiceBook> {
  return parseWithOcrPipeline(imageBase64, access, serviceBookSchema, SERVICE_BOOK_PROMPT, modelId)
}

/** Serviceheft als PDF (eingescannte Seiten): alle Seiten per OCR, gemeinsam auswerten */
export async function parseServiceBookPdf(
  pdfBase64: string,
  access: AiAccess,
  modelId?: string,
): Promise<ParsedServiceBook> {
  const pages = await withRetry(() => callMistralOcrPdf(pdfBase64, access))
  const text = pages.map((t, i) => `--- Seite ${i + 1} ---\n${t}`).join('\n\n')
  return parseOcrText(text, access, serviceBookSchema, SERVICE_BOOK_PROMPT, modelId)
}
