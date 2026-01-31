import type { AiProvider } from '../stores/settings'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
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
    category: z.string().describe(
      'Kategorie der Arbeit. Erlaubte Werte: oelwechsel, bremsen, reifen, inspektion, luftfilter, zahnriemen, bremsflüssigkeit, klimaanlage, tuev, karosserie, elektrik, sonstiges',
    ),
    amount: z.number().describe('Betrag in Euro'),
  })),
})

export type ParsedInvoice = z.infer<typeof invoiceSchema>

interface ModelOptions {
  provider: AiProvider
  apiKey: string
  ollamaUrl?: string
  ollamaModel?: string
}

function getModel(opts: ModelOptions) {
  switch (opts.provider) {
    case 'google':
      return createGoogleGenerativeAI({ apiKey: opts.apiKey })('gemini-2.0-flash')
    case 'anthropic':
      return createAnthropic({ apiKey: opts.apiKey })('claude-sonnet-4-20250514')
    case 'openai':
      return createOpenAI({ apiKey: opts.apiKey })('gpt-4o-mini')
    case 'ollama':
      return createOpenAI({
        baseURL: `${opts.ollamaUrl || 'http://localhost:11434'}/v1`,
        apiKey: 'ollama',
      })(opts.ollamaModel || 'qwen2-vl')
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
      // Wait 60s+ to respect per-minute quota windows
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
  ollamaUrl?: string,
  ollamaModel?: string,
): Promise<ParsedInvoice> {
  const model = getModel({ provider, apiKey, ollamaUrl, ollamaModel })

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
