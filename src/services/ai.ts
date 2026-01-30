import type { AiProvider } from '../stores/settings'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'

const invoiceSchema = z.object({
  workshopName: z.string().describe('Name der Werkstatt'),
  date: z.string().describe('Rechnungsdatum im Format YYYY-MM-DD'),
  totalAmount: z.number().describe('Gesamtbetrag in Euro'),
  mileageAtService: z.number().optional().describe('Kilometerstand falls angegeben'),
  items: z.array(z.object({
    description: z.string().describe('Beschreibung der Arbeit'),
    category: z.string().describe('Kategorie: oelwechsel, bremsen, reifen, inspektion, karosserie, elektrik, sonstiges'),
    amount: z.number().describe('Betrag in Euro'),
  })),
})

export type ParsedInvoice = z.infer<typeof invoiceSchema>

function getModel(provider: AiProvider, apiKey: string) {
  switch (provider) {
    case 'google':
      return createGoogleGenerativeAI({ apiKey })('gemini-2.0-flash')
    case 'anthropic':
      return createAnthropic({ apiKey })('claude-sonnet-4-20250514')
    case 'openai':
      return createOpenAI({ apiKey })('gpt-4o-mini')
  }
}

export async function parseInvoice(
  imageBase64: string,
  provider: AiProvider,
  apiKey: string,
): Promise<ParsedInvoice> {
  const model = getModel(provider, apiKey)

  const { object } = await generateObject({
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
  })

  return object
}
