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
  'sonstiges',
] as const

export type MaintenanceCategory = typeof MAINTENANCE_CATEGORIES[number]

const invoiceSchema = z.object({
  workshopName: z.string().describe('Name der Werkstatt'),
  date: z.string().describe('Rechnungsdatum im Format YYYY-MM-DD'),
  totalAmount: z.number().describe('Gesamtbetrag in Euro'),
  mileageAtService: z.number().optional().describe('Kilometerstand falls angegeben'),
  items: z.array(z.object({
    description: z.string().describe('Beschreibung der Arbeit'),
    category: z.enum(MAINTENANCE_CATEGORIES).describe(
      'Kategorie der Arbeit: oelwechsel, bremsen, reifen, inspektion, luftfilter, zahnriemen, bremsflüssigkeit, klimaanlage, tuev, karosserie, elektrik, sonstiges',
    ),
    amount: z.number().describe('Betrag in Euro'),
  })),
})

export type ParsedInvoice = z.infer<typeof invoiceSchema>

const vehicleDocumentSchema = z.object({
  documentType: z.string().describe('Art des Dokuments: kaufvertrag, fahrzeugschein, sonstiges'),
  make: z.string().describe('Marke des Fahrzeugs'),
  model: z.string().describe('Modell des Fahrzeugs'),
  year: z.number().describe('Baujahr oder Erstzulassung'),
  vin: z.string().optional().describe('Fahrgestellnummer (VIN) falls sichtbar'),
  plate: z.string().optional().describe('Kennzeichen falls sichtbar'),
  mileage: z.number().optional().describe('Kilometerstand falls angegeben'),
  engineType: z.string().optional().describe('Motortyp: Diesel, Benzin, Elektro, Hybrid'),
  enginePower: z.string().optional().describe('Leistung z.B. 140 kW / 190 PS'),
  purchaseDate: z.string().optional().describe('Kaufdatum im Format YYYY-MM-DD'),
  purchasePrice: z.number().optional().describe('Kaufpreis in Euro'),
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

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
  let lastError: any
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    }
    catch (e: any) {
      lastError = e
      const msg = e.message || ''
      const isRateLimit = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || e.statusCode === 429
      if (!isRateLimit || attempt === maxRetries)
        break
      const waitMs = Math.max(60_000, 4000 * 2 ** attempt)
      await new Promise(r => setTimeout(r, waitMs))
    }
  }
  throw new Error(`Failed after ${maxRetries + 1} attempts. Last error: ${lastError?.message || lastError}`)
}

export async function parseInvoice(
  imageBase64: string,
  provider: AiProvider,
  apiKey: string,
  modelId?: string,
): Promise<ParsedInvoice> {
  const model = getModel({ provider, apiKey, model: modelId })

  const { object } = await withRetry(() => generateObject({
    model,
    schema: invoiceSchema,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Analysiere diese Werkstattrechnung. Extrahiere alle relevanten Daten. Antworte auf Deutsch.',
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

export async function parseVehicleDocument(
  imageBase64: string,
  provider: AiProvider,
  apiKey: string,
  modelId?: string,
): Promise<ParsedVehicleDocument> {
  const model = getModel({ provider, apiKey, model: modelId })

  const { object } = await withRetry(() => generateObject({
    model,
    schema: vehicleDocumentSchema,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Analysiere dieses Fahrzeugdokument (Kaufvertrag, Fahrzeugschein oder Zulassungsbescheinigung). Extrahiere alle Fahrzeugdaten. Antworte auf Deutsch.',
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

export async function parseServiceBook(
  imageBase64: string,
  provider: AiProvider,
  apiKey: string,
  modelId?: string,
): Promise<ParsedServiceBook> {
  const model = getModel({ provider, apiKey, model: modelId })

  const { object } = await withRetry(() => generateObject({
    model,
    schema: serviceBookSchema,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Analysiere diese Service-Heft Seite. Extrahiere alle Wartungseinträge mit Datum, Kilometerstand und durchgeführten Arbeiten. Falls Hersteller-Wartungsintervalle sichtbar sind, extrahiere diese ebenfalls. Antworte auf Deutsch.',
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
