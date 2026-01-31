import type { AiProvider } from '../src/stores/settings'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
/**
 * AI-Provider-Vergleich für Rechnungs-Scan.
 * Usage: npx tsx scripts/compare-ai.ts
 */
import process from 'node:process'
import { config } from 'dotenv'
import { parseInvoice } from '../src/services/ai'

config({ path: resolve(import.meta.dirname, '..', '.env') })

const imagePath = resolve(import.meta.dirname, '..', 'e2e', 'fixtures', 'test-invoice.png')
const imageBase64 = readFileSync(imagePath).toString('base64')

interface ProviderConfig {
  name: string
  provider: AiProvider
  apiKey: string
}

const providers: ProviderConfig[] = [
  {
    name: 'OpenRouter (Gemini 2.0 Flash)',
    provider: 'openrouter',
    apiKey: process.env.OPENROUTER_API_KEY || '',
  },
]

async function testProvider(cfg: ProviderConfig) {
  if (!cfg.apiKey)
    return { name: cfg.name, error: 'Kein API-Key', time: 0 }

  const start = Date.now()
  try {
    const result = await parseInvoice(imageBase64, cfg.provider, cfg.apiKey)
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

  for (const provider of providers) {
    console.log(`Testing: ${provider.name}...`)
    const result = await testProvider(provider)

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
}

main().catch(console.error)
