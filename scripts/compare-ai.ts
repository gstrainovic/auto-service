/**
 * Vergleicht AI-Provider beim Rechnungs-Scan.
 * Nutzt dasselbe Test-Rechnungsbild mit allen konfigurierten Providern.
 *
 * Usage: npx tsx scripts/compare-ai.ts
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import { parseInvoice } from '../src/services/ai'
import type { AiProvider } from '../src/stores/settings'

config({ path: resolve(import.meta.dirname, '..', '.env') })

const imagePath = resolve(import.meta.dirname, '..', 'e2e', 'fixtures', 'test-invoice.png')
const imageBase64 = readFileSync(imagePath).toString('base64')

interface ProviderConfig {
  name: string
  provider: AiProvider
  apiKey: string
  ollamaUrl?: string
  ollamaModel?: string
}

const providers: ProviderConfig[] = [
  {
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    apiKey: process.env.GEMINI_API_KEY || '',
  },
  {
    name: 'Groq (Llama 3.2 11B Vision)',
    provider: 'groq',
    apiKey: process.env.GROQ_API_KEY || '',
    ollamaModel: 'llama-3.2-11b-vision-preview',
  },
  {
    name: 'OpenRouter (Gemini 2.0 Flash)',
    provider: 'openrouter',
    apiKey: process.env.OPENROUTER_API_KEY || '',
    ollamaModel: 'google/gemini-2.0-flash-001',
  },
  {
    name: 'Mistral (Pixtral 12B)',
    provider: 'mistral',
    apiKey: process.env.MISTRAL_API_KEY || '',
    ollamaModel: 'pixtral-12b-2409',
  },
  {
    name: 'Ollama (minicpm-v)',
    provider: 'ollama',
    apiKey: '',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'minicpm-v',
  },
]

async function testProvider(cfg: ProviderConfig) {
  if (!cfg.apiKey && cfg.provider !== 'ollama') {
    return { name: cfg.name, error: 'Kein API-Key', time: 0 }
  }

  const start = Date.now()
  try {
    const result = await parseInvoice(
      imageBase64,
      cfg.provider,
      cfg.apiKey,
      cfg.ollamaUrl,
      cfg.ollamaModel,
    )
    const time = Date.now() - start
    return { name: cfg.name, result, time, error: null }
  }
  catch (e: any) {
    const time = Date.now() - start
    return { name: cfg.name, error: e.message?.slice(0, 200), time }
  }
}

async function main() {
  console.log('=== AI Provider Vergleich: Rechnungs-Scan ===\n')
  console.log(`Bild: ${imagePath}\n`)

  const results = []

  for (const provider of providers) {
    console.log(`Testing: ${provider.name}...`)
    const result = await testProvider(provider)
    results.push(result)

    if (result.error) {
      console.log(`  FEHLER (${result.time}ms): ${result.error}\n`)
    }
    else {
      const r = result.result!
      console.log(`  OK (${result.time}ms)`)
      console.log(`  Werkstatt: ${r.workshopName}`)
      console.log(`  Datum: ${r.date}`)
      console.log(`  Betrag: ${r.totalAmount} €`)
      console.log(`  km-Stand: ${r.mileageAtService || '-'}`)
      console.log(`  Positionen: ${r.items.length}`)
      for (const item of r.items) {
        console.log(`    - ${item.description} [${item.category}] ${item.amount} €`)
      }
      console.log()
    }
  }

  // Summary table
  console.log('\n=== Zusammenfassung ===\n')
  console.log('Provider'.padEnd(35), 'Zeit'.padEnd(10), 'Werkstatt'.padEnd(25), 'Betrag'.padEnd(10), 'Positionen')
  console.log('-'.repeat(95))
  for (const r of results) {
    if (r.error) {
      console.log(r.name.padEnd(35), `${r.time}ms`.padEnd(10), `FEHLER: ${r.error.slice(0, 50)}`)
    }
    else {
      const res = r.result!
      console.log(
        r.name.padEnd(35),
        `${r.time}ms`.padEnd(10),
        (res.workshopName || '-').padEnd(25),
        `${res.totalAmount} €`.padEnd(10),
        String(res.items.length),
      )
    }
  }
}

main().catch(console.error)
