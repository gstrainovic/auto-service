/* eslint-disable node/prefer-global/process */
/**
 * Testet alle 9 Bilder aus tmp/test-images/ durch die OCR+Parse-Pipeline.
 * Nutzung: npx tsx scripts/test-9-images.ts [label]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { callMistralOcr, parseInvoice } from '../src/services/ai'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const IMAGE_DIR = path.join(__dirname, '..', 'tmp', 'test-images')
const API_KEY = process.env.VITE_AI_API_KEY!
const LABEL = process.argv[2] || 'Test'

interface TestResult {
  file: string
  ocrMs: number
  parseMs: number
  totalMs: number
  workshop: string
  date: string
  total: string
  currency: string
  mileage: string
  plate: string
  vin: string
  items: { desc: string, cat: string, amt: number }[]
  error?: string
}

async function testImage(filePath: string): Promise<TestResult> {
  const file = path.basename(filePath)
  const imageBase64 = fs.readFileSync(filePath).toString('base64')

  try {
    // Phase 1: OCR
    const ocrStart = Date.now()
    const _ocrText = await callMistralOcr(imageBase64, API_KEY)
    const ocrMs = Date.now() - ocrStart

    // Phase 2: Parse
    const parseStart = Date.now()
    const r = await parseInvoice(imageBase64, 'mistral', API_KEY)
    const parseMs = Date.now() - parseStart

    return {
      file,
      ocrMs,
      parseMs,
      totalMs: ocrMs + parseMs,
      workshop: r.workshopName || '-',
      date: r.date || '-',
      total: String(r.totalAmount ?? '-'),
      currency: r.currency || '-',
      mileage: String(r.mileageAtService ?? '-'),
      plate: r.licensePlate || '-',
      vin: r.vin || '-',
      items: (r.items || []).map(i => ({ desc: i.description, cat: i.category, amt: i.amount })),
    }
  }
  catch (e: any) {
    // Try to extract partial result from error
    const value = e.value || e.cause?.value
    if (value) {
      return {
        file,
        ocrMs: 0,
        parseMs: 0,
        totalMs: 0,
        workshop: value.workshopName || '-',
        date: value.date || '-',
        total: String(value.totalAmount ?? '-'),
        currency: value.currency || '-',
        mileage: String(value.mileageAtService ?? '-'),
        plate: value.licensePlate || '-',
        vin: value.vin || '-',
        items: (value.items || []).map((i: any) => ({ desc: i.description, cat: i.category, amt: i.amount })),
        error: 'partial',
      }
    }
    return {
      file,
      ocrMs: 0,
      parseMs: 0,
      totalMs: 0,
      workshop: '',
      date: '',
      total: '',
      currency: '',
      mileage: '',
      plate: '',
      vin: '',
      items: [],
      error: e.message?.slice(0, 80),
    }
  }
}

async function main() {
  const files = fs.readdirSync(IMAGE_DIR)
    .filter(f => f.endsWith('.jpg') || f.endsWith('.png'))
    .sort()
    .map(f => path.join(IMAGE_DIR, f))

  console.log(`\n${LABEL}: Teste ${files.length} Bilder...\n`)

  const results: TestResult[] = []
  for (const file of files) {
    const name = path.basename(file)
    process.stdout.write(`  ${name} ...`)
    const r = await testImage(file)
    console.log(r.error ? ` ⚠ ${r.error}` : ` ✓ ${r.ocrMs}+${r.parseMs}=${r.totalMs}ms`)
    results.push(r)
    await new Promise(r => setTimeout(r, 2000))
  }

  // Summary table
  console.log(`\n## ${LABEL}\n`)
  console.log('| # | Werkstatt | Datum | Betrag | Währ. | km | Kennz. | VIN | Kategorien | OCR ms | Parse ms | Total ms |')
  console.log('|---|-----------|-------|--------|-------|----|--------|-----|------------|--------|----------|----------|')
  results.forEach((r, i) => {
    const cats = r.items.map(it => `${it.cat}(${it.amt})`).join(', ')
    const err = r.error ? ` ⚠${r.error}` : ''
    console.log(`| ${i + 1} | ${r.workshop} | ${r.date} | ${r.total} | ${r.currency} | ${r.mileage} | ${r.plate} | ${r.vin} | ${cats} | ${r.ocrMs} | ${r.parseMs} | ${r.totalMs}${err} |`)
  })

  const ok = results.filter(r => !r.error)
  if (ok.length) {
    const avgOcr = Math.round(ok.reduce((s, r) => s + r.ocrMs, 0) / ok.length)
    const avgParse = Math.round(ok.reduce((s, r) => s + r.parseMs, 0) / ok.length)
    console.log(`\n∅ OCR: ${avgOcr}ms, Parse: ${avgParse}ms, Total: ${avgOcr + avgParse}ms`)
  }
  console.log(`Fehler: ${results.filter(r => r.error).length}/${results.length}`)

  // Items detail
  console.log(`\n### Positionen Detail\n`)
  results.forEach((r, i) => {
    console.log(`**Bild ${i + 1}** (${r.workshop}):`)
    r.items.forEach(it => console.log(`  - ${it.desc} → ${it.cat} (${it.amt})`))
    console.log()
  })
}

main().catch(console.error)
