import type { RxDatabase } from 'rxdb'
import type { AiProvider } from '../stores/settings'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createMistral } from '@ai-sdk/mistral'
import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'

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

const invoiceSchema = z.object({
  workshopName: z.string().describe('Name der Werkstatt'),
  date: z.string().describe('Rechnungsdatum im Format YYYY-MM-DD'),
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
  documentType: z.string().describe('Art des Dokuments: kaufvertrag, fahrzeugschein, sonstiges'),
  make: z.string().describe('Marke des Fahrzeugs'),
  model: z.string().describe('Modell des Fahrzeugs'),
  year: z.number().describe('Baujahr oder Erstzulassung'),
  vin: z.string().nullable().optional().describe('Fahrgestellnummer (VIN) falls sichtbar'),
  plate: z.string().nullable().optional().describe('Kennzeichen falls sichtbar'),
  mileage: z.number().nullable().optional().describe('Kilometerstand falls angegeben'),
  engineType: z.string().nullable().optional().describe('Motortyp: Diesel, Benzin, Elektro, Hybrid'),
  enginePower: z.string().nullable().optional().describe('Leistung z.B. 140 kW / 190 PS'),
  purchaseDate: z.string().nullable().optional().describe('Kaufdatum im Format YYYY-MM-DD'),
  purchasePrice: z.number().nullable().optional().describe('Kaufpreis in Euro'),
})

export type ParsedVehicleDocument = z.infer<typeof vehicleDocumentSchema>

const serviceBookSchema = z.object({
  entries: z.array(z.object({
    date: z.string().describe('Datum im Format YYYY-MM-DD'),
    mileage: z.number().describe('Kilometerstand'),
    workshopName: z.string().optional().describe('Name der Werkstatt'),
    items: z.array(z.object({
      description: z.string().describe('Beschreibung der Arbeit'),
      category: z.enum(MAINTENANCE_CATEGORIES).describe(
        'Kategorie: oelwechsel, bremsen, reifen, inspektion, luftfilter, zahnriemen, bremsflüssigkeit, klimaanlage, tuev, karosserie, elektrik, sonstiges',
      ),
    })),
  })),
  manufacturerIntervals: z.array(z.object({
    type: z.string().describe('Wartungstyp (oelwechsel, inspektion, bremsen, etc.)'),
    intervalKm: z.number().describe('Intervall in km, 0 wenn nur zeitbasiert'),
    intervalMonths: z.number().describe('Intervall in Monaten'),
  })).optional().describe('Hersteller-Wartungsintervalle falls auf der Seite sichtbar'),
})

export type ParsedServiceBook = z.infer<typeof serviceBookSchema>

const DEFAULT_MODELS: Record<AiProvider, string> = {
  'mistral': 'mistral-small-latest',
  'anthropic': 'claude-sonnet-4-20250514',
  'openai': 'gpt-4o-mini',
  'meta-llama': 'meta-llama/llama-4-maverick',
  'ollama': 'qwen3-vl:2b',
}

interface ModelOptions {
  provider: AiProvider
  apiKey: string
  model?: string
}

export function getModel(opts: ModelOptions) {
  const modelId = opts.model || DEFAULT_MODELS[opts.provider]
  switch (opts.provider) {
    case 'anthropic':
      return createAnthropic({ apiKey: opts.apiKey })(modelId)
    case 'openai':
      return createOpenAI({ apiKey: opts.apiKey })(modelId)
    case 'mistral':
      return createMistral({ apiKey: opts.apiKey })(modelId)
    case 'meta-llama':
      return createOpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: opts.apiKey,
      })(modelId)
    case 'ollama':
      return createOpenAI({
        baseURL: 'http://localhost:11434/v1',
        apiKey: 'ollama',
      })(modelId)
  }
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

async function hashImage(base64: string): Promise<string> {
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
export async function callMistralOcr(imageBase64: string, apiKey: string, db?: RxDatabase): Promise<string> {
  const hash = await hashImage(imageBase64)

  // 1. In-Memory-Cache (schnellste Stufe)
  const memCached = ocrCache.get(hash)
  if (memCached)
    return memCached

  // 2. RxDB-Cache (persistente Stufe)
  if (db) {
    const dbDoc = await (db as any).ocrcache.findOne({ selector: { id: hash } }).exec()
    if (dbDoc) {
      const text = dbDoc.markdown
      ocrCache.set(hash, text)
      return text
    }
  }

  const resp = await fetch('https://api.mistral.ai/v1/ocr', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'mistral-ocr-latest',
      document: {
        type: 'image_url',
        image_url: `data:image/jpeg;base64,${imageBase64}`,
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

  // In RxDB persistieren
  if (db) {
    try {
      await (db as any).ocrcache.insert({ id: hash, markdown: text, createdAt: new Date().toISOString() })
    }
    catch {}
  }

  return text
}

/**
 * Ruft die Mistral OCR API für ein PDF-Dokument auf.
 * Gibt ein Array von Markdown-Texten zurück (einer pro Seite).
 * Mistral OCR: max 50 MB Dateigröße, max 1000 Seiten.
 */
export async function callMistralOcrPdf(pdfBase64: string, apiKey: string): Promise<string[]> {
  const resp = await fetch('https://api.mistral.ai/v1/ocr', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
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
  apiKey: string,
  schema: z.ZodType<T>,
  prompt: string,
  modelId?: string,
  db?: RxDatabase,
): Promise<T> {
  const ocrText = await withRetry(() => callMistralOcr(imageBase64, apiKey, db))
  const model = getModel({ provider: 'mistral', apiKey, model: modelId })

  const { object } = await withRetry(() => generateObject({
    model,
    maxRetries: 0,
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

WICHTIG — Positionen extrahieren:
- Lies die Tabellenspalten korrekt: Beschreibung | Menge | Einheit | Preis | Betrag
- Der "Betrag" pro Position = Menge × Einzelpreis
- Unterscheide ARBEITSKOSTEN (Stunden × Stundensatz) von MATERIALKOSTEN (Teile)
- "Summe Arbeiten" und "Summe Teile" sind Zwischensummen — KEINE eigenen Positionen
- Klein- & Reinigungs-Material und Lieferspesen sind eigene Positionen
- Kontrolliere: Die Summe aller Positions-Beträge muss ungefähr dem Netto-Gesamtbetrag (vor MwSt.) entsprechen

WICHTIG — Währung:
- "CHF" oder "Totalbetrag CHF" → Währung ist CHF
- "€" oder "EUR" oder "inkl. MwSt." ohne CHF → Währung ist EUR

WICHTIG — Kategorien richtig zuordnen:
- Federn, Stoßdämpfer, Federbeine, Achse, Lenkung, Radlager → fahrwerk
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
  provider: AiProvider,
  apiKey: string,
  modelId?: string,
  db?: RxDatabase,
): Promise<ParsedInvoice> {
  // Mistral: OCR-Pipeline (perfekte Tabellenextraktion → JSON-Parsing)
  if (provider === 'mistral') {
    return parseWithOcrPipeline(imageBase64, apiKey, invoiceSchema, INVOICE_PROMPT, modelId, db)
  }

  // Andere Provider: direkte Bild-Analyse
  const model = getModel({ provider, apiKey, model: modelId })
  const { object } = await withRetry(() => generateObject({
    model,
    maxRetries: 0,
    schema: invoiceSchema,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: `${INVOICE_PROMPT}\n\nDas Bild kann gedreht sein (90° oder 180°) — lies den Text in der richtigen Leserichtung.`,
        },
        {
          type: 'image',
          image: imageBase64,
        },
      ],
    }],
  }))

  return object
}

const VEHICLE_DOC_PROMPT = 'Analysiere dieses Fahrzeugdokument (Kaufvertrag, Fahrzeugschein oder Zulassungsbescheinigung). Extrahiere alle Fahrzeugdaten. Antworte auf Deutsch.'

export async function parseVehicleDocument(
  imageBase64: string,
  provider: AiProvider,
  apiKey: string,
  modelId?: string,
  db?: RxDatabase,
): Promise<ParsedVehicleDocument> {
  if (provider === 'mistral') {
    return parseWithOcrPipeline(imageBase64, apiKey, vehicleDocumentSchema, VEHICLE_DOC_PROMPT, modelId, db)
  }

  const model = getModel({ provider, apiKey, model: modelId })
  const { object } = await withRetry(() => generateObject({
    model,
    maxRetries: 0,
    schema: vehicleDocumentSchema,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: VEHICLE_DOC_PROMPT },
        { type: 'image', image: imageBase64 },
      ],
    }],
  }))

  return object
}

const SERVICE_BOOK_PROMPT = 'Analysiere diese Service-Heft Seite. Extrahiere alle Wartungseinträge mit Datum, Kilometerstand und durchgeführten Arbeiten. Falls Hersteller-Wartungsintervalle sichtbar sind, extrahiere diese ebenfalls. Antworte auf Deutsch.'

export async function parseServiceBook(
  imageBase64: string,
  provider: AiProvider,
  apiKey: string,
  modelId?: string,
  db?: RxDatabase,
): Promise<ParsedServiceBook> {
  if (provider === 'mistral') {
    return parseWithOcrPipeline(imageBase64, apiKey, serviceBookSchema, SERVICE_BOOK_PROMPT, modelId, db)
  }

  const model = getModel({ provider, apiKey, model: modelId })
  const { object } = await withRetry(() => generateObject({
    model,
    maxRetries: 0,
    schema: serviceBookSchema,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: SERVICE_BOOK_PROMPT },
        { type: 'image', image: imageBase64 },
      ],
    }],
  }))

  return object
}
