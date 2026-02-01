/* eslint-disable node/prefer-global/process */
/**
 * Testet Document Annotation Pipeline (Ein-Stufen) auf alle 9 Bilder.
 * Ruft callMistralOcrWithAnnotation direkt auf, umgeht Cache.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { MAINTENANCE_CATEGORIES, withRetry } from '../src/services/ai'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const IMAGE_DIR = path.join(__dirname, '..', 'tmp', 'test-images')
const API_KEY = process.env.VITE_AI_API_KEY!

const invoiceSchema = z.object({
  workshopName: z.string().describe('Name der Werkstatt'),
  date: z.string().describe('Rechnungsdatum im Format YYYY-MM-DD'),
  totalAmount: z.number().describe('Gesamtbetrag (brutto, inkl. MwSt.)'),
  currency: z.string().describe('Währung: CHF, EUR, USD etc.'),
  mileageAtService: z.number().nullable().optional().describe('Kilometerstand bei Reparatur falls angegeben'),
  licensePlate: z.string().nullable().optional().describe('Kennzeichen des Fahrzeugs (z.B. SG 218574, M-AB 1234)'),
  vin: z.string().nullable().optional().describe('Fahrgestellnummer/VIN (17-stellig)'),
  items: z.array(z.object({
    description: z.string().describe('Beschreibung der Arbeit oder des Teils'),
    category: z.enum(MAINTENANCE_CATEGORIES).describe(
      'Kategorie: oelwechsel, bremsen, reifen, inspektion, luftfilter, zahnriemen, bremsflüssigkeit, klimaanlage, tuev, karosserie, fahrwerk, auspuff, kuehlung, autoglas, elektrik, sonstiges',
    ),
    amount: z.number().describe('Einzelbetrag dieser Position'),
  })),
})

const PROMPT = `Analysiere diese Werkstattrechnung sorgfältig.

WICHTIG — Kennzeichen vs. Fahrgestellnummer:
- Kennzeichen (license plate): Kürzel + Zahlen, z.B. "SG 218574", "M-AB 1234". NICHT die Fahrgestellnummer!
- Fahrgestellnummer/VIN: 17 Zeichen, beginnt mit W, V, etc.

WICHTIG — Positionen:
- "Summe Arbeiten" und "Summe Teile" sind Zwischensummen — KEINE eigenen Positionen
- Klein- & Reinigungs-Material und Lieferspesen sind eigene Positionen

WICHTIG — Kategorien:
- Federn, Stoßdämpfer, Federbeine, Achse, Radlager → fahrwerk
- Auspuff, Katalysator, Abgasanlage → auspuff
- Kühlwasser, Kühler, Frostschutz, Unterdruckleitung → kuehlung
- Windschutzscheibe, Autoglas, Scheibenwischer → autoglas
- Ölwechsel, Ölfilter, Motoröl → oelwechsel
- Bremsen, Bremsbeläge → bremsen
- Reifen, Reifenwechsel, Auswuchten → reifen

WICHTIG — Beträge als Zahlen:
- "1 014.80" → 1014.80
- "540,00" → 540.00

Extrahiere alle Daten.`

interface OcrPage {
  markdown?: string
  tables?: { id: string, content: string }[]
}

async function callAnnotation(imageBase64: string) {
  const jsonSchema = z.toJSONSchema(invoiceSchema)

  const resp = await fetch('https://api.mistral.ai/v1/ocr', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'mistral-ocr-latest',
      document: {
        type: 'image_url',
        image_url: `data:image/jpeg;base64,${imageBase64}`,
      },
      table_format: 'markdown',
      document_annotation_format: {
        type: 'json_schema',
        json_schema: {
          name: 'document_annotation',
          schema: jsonSchema,
        },
      },
      document_annotation_prompt: PROMPT,
    }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(`OCR+Annotation error ${resp.status}: ${(err as any).error?.message || resp.statusText}`)
  }

  const data = await resp.json() as { pages?: OcrPage[], document_annotation?: string }
  const markdown = data.pages?.map((p) => {
    let md = p.markdown || ''
    if (p.tables?.length) {
      for (const tbl of p.tables)
        md = md.replace(`[${tbl.id}](${tbl.id})`, tbl.content)
    }
    return md
  }).join('\n\n') || ''

  return { markdown, annotation: data.document_annotation }
}

async function main() {
  const files = fs.readdirSync(IMAGE_DIR)
    .filter(f => f.endsWith('.jpg') || f.endsWith('.png'))
    .sort()
    .map(f => path.join(IMAGE_DIR, f))

  console.log(`\nRunde 3: Document Annotation (Ein-Stufe) — ${files.length} Bilder\n`)

  const results: any[] = []
  for (const file of files) {
    const name = path.basename(file)
    process.stdout.write(`  ${name} ...`)
    const imageBase64 = fs.readFileSync(file).toString('base64')
    const start = Date.now()

    try {
      const { annotation } = await withRetry(() => callAnnotation(imageBase64))
      const ms = Date.now() - start

      if (!annotation) {
        console.log(` ⚠ keine Annotation (${ms}ms)`)
        results.push({ name, ms, error: 'keine annotation', data: null })
        continue
      }

      let data: any
      try {
        data = invoiceSchema.parse(JSON.parse(annotation))
      }
      catch (e: any) {
        // Try raw parse
        data = JSON.parse(annotation)
        console.log(` ⚠ Schema-Validierung fehlgeschlagen (${ms}ms): ${e.message?.slice(0, 60)}`)
        results.push({ name, ms, error: 'schema', data })
        await new Promise(r => setTimeout(r, 2000))
        continue
      }

      console.log(` ✓ ${ms}ms`)
      results.push({ name, ms, error: null, data })
    }
    catch (e: any) {
      const ms = Date.now() - start
      console.log(` ❌ ${e.message?.slice(0, 80)} (${ms}ms)`)
      results.push({ name, ms, error: e.message?.slice(0, 80), data: null })
    }
    await new Promise(r => setTimeout(r, 2000))
  }

  // Table
  console.log('\n## Runde 3: Document Annotation (Ein-Stufe)\n')
  console.log('| # | Werkstatt | Datum | Betrag | Währ. | km | Kennz. | VIN | Kategorien | ms | Status |')
  console.log('|---|-----------|-------|--------|-------|----|--------|-----|------------|-----|--------|')
  results.forEach((r, i) => {
    if (!r.data) {
      console.log(`| ${i + 1} | ❌ ${r.error || ''} | | | | | | | | ${r.ms} | FAIL |`)
      return
    }
    const d = r.data
    const cats = (d.items || []).map((it: any) => `${it.category}(${it.amount})`).join(', ')
    const status = r.error ? `⚠${r.error}` : '✓'
    console.log(`| ${i + 1} | ${d.workshopName || '-'} | ${d.date || '-'} | ${d.totalAmount ?? '-'} | ${d.currency || '-'} | ${d.mileageAtService ?? '-'} | ${d.licensePlate || '-'} | ${d.vin || '-'} | ${cats} | ${r.ms} | ${status} |`)
  })

  const ok = results.filter(r => r.data && !r.error)
  if (ok.length) {
    const avg = Math.round(ok.reduce((s: number, r: any) => s + r.ms, 0) / ok.length)
    console.log(`\n∅ Total: ${avg}ms (ein einzelner API-Call)`)
  }
  console.log(`Erfolg: ${ok.length}/${results.length}, Fehler: ${results.filter(r => r.error).length}/${results.length}`)

  // Items detail
  console.log('\n### Positionen Detail\n')
  results.forEach((r, i) => {
    if (!r.data)
      return
    console.log(`**Bild ${i + 1}** (${r.data.workshopName || '?'}):`)
    for (const it of r.data.items || [])
      console.log(`  - ${it.description} → ${it.category} (${it.amount})`)
    console.log()
  })
}

main().catch(console.error)
