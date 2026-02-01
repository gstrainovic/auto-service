import type { RxDatabase } from 'rxdb'
import type { AiProvider } from '../stores/settings'
import { generateText, stepCountIs, tool } from 'ai'
import { z } from 'zod'
import { autoRotateForDocument } from '../composables/useImageResize'
import { callMistralOcr, callMistralOcrPdf, getModel, MAINTENANCE_CATEGORIES, parseInvoice, parseServiceBook, parseVehicleDocument, withRetry } from './ai'
import { checkDueMaintenances, getMaintenanceSchedule } from './maintenance-schedule'

/**
 * Regelbasierte Kategorie-Korrektur: Überschreibt die AI-Zuordnung wenn
 * eindeutige Keywords in der Beschreibung gefunden werden.
 * Löst das Problem dass z.B. "Auspuff reparieren" → sonstiges statt auspuff.
 */
const CATEGORY_KEYWORDS: [RegExp, string][] = [
  [/auspuff|katalysator|kr[üu]mmer|abgasanlage|endtopf|mitteltopf/i, 'auspuff'],
  [/k[üu]hl(wasser|er|mittel|fl[üu]ssigkeit)|frostschutz|thermostat|unterdruck/i, 'kuehlung'],
  [/windschutzscheibe|frontscheibe|heckscheibe|autoglas|scheibenwischer/i, 'autoglas'],
  [/[öo]lwechsel|[öo]lfilter|motor[öo]l|[öo]lablassschraube/i, 'oelwechsel'],
  [/bremsbe[lä]|bremsscheib|bremss[aä]ttel|bremstrommel|bremsbacke/i, 'bremsen'],
  [/\breifen\b|reifenmontage|reifenwechsel|auswuchten|winterreifen|sommerreifen/i, 'reifen'],
  [/feder(bein)?|sto[ßs]d[äa]mpfer|radlager|achse|lenkung|querlenker|spurstange|traggelenk/i, 'fahrwerk'],
  [/batterie|lichtmaschine|starter|z[üu]ndkerze|z[üu]ndspule/i, 'elektrik'],
  [/lack|karosserie|rost|delle|unfallschaden|blech/i, 'karosserie'],
  [/inspektion|service(?!.*heft)|durchsicht|hu.vorbereitung/i, 'inspektion'],
  [/klimaanlage|klima.service|k[äa]ltemittel/i, 'klimaanlage'],
  [/zahnriemen|steuerriemen|steuerkette/i, 'zahnriemen'],
  [/bremsfl[üu]ssigkeit/i, 'bremsflüssigkeit'],
  [/luftfilter|pollenfilter|innenraumfilter/i, 'luftfilter'],
  [/t[üu]v\b|hauptuntersuchung|\bhu\b|\bau\b/i, 'tuev'],
]

function correctCategory(description: string, aiCategory: string): string {
  const desc = description.toLowerCase()
  for (const [pattern, category] of CATEGORY_KEYWORDS) {
    if (pattern.test(desc))
      return category
  }
  return aiCategory
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  attachment?: { type: 'image' | 'pdf', name: string, preview?: string }
  attachments?: { type: 'image' | 'pdf', name: string, preview?: string }[]
}

const SYSTEM_PROMPT = `Du bist der Auto-Service Assistent. Du hilfst beim Verwalten von Fahrzeugen und Wartungen.
Deine Fähigkeiten:
- Fahrzeuge anlegen, bearbeiten, löschen
- Rechnungen und Wartungen eintragen
- Fotos von Rechnungen, Kaufverträgen, Fahrzeugscheinen und Service-Heften analysieren
- Wartungsstatus prüfen und Empfehlungen geben
- Fragen zu Wartungsintervallen beantworten

FAHRZEUG-ERKENNUNG:
- Der Benutzer kennt KEINE IDs. Er sagt z.B. "mein BMW", "der Golf", "das Fahrzeug".
- Du bekommst die Fahrzeugliste automatisch als Kontext. Nutze sie um das richtige Fahrzeug zu identifizieren.
- Wenn nur EIN Fahrzeug existiert, verwende es automatisch ohne nachzufragen.
- Wenn MEHRERE Fahrzeuge passen könnten, frage kurz nach: "Meinst du den BMW 320d oder den BMW X3?"
- Rufe NIEMALS den Benutzer auf eine ID zu nennen.

WICHTIGE REGELN:
1. Bevor du ein Fahrzeug anlegst, zeige ALLE Felder dem Benutzer und warte auf Bestätigung:
   - Marke, Modell, Baujahr, Kilometerstand, Kennzeichen, Fahrgestellnummer
2. Bevor du eine Rechnung einträgst, zeige ALLE Felder dem Benutzer und warte auf Bestätigung:
   - Werkstatt, Datum, Gesamtbetrag, Währung, Kilometerstand, alle Positionen (Beschreibung, Kategorie, Betrag)
3. Führe KEINE Tools aus bevor der Benutzer die Daten bestätigt hat.
4. Wenn du unsicher bist über ein Feld, zeige was du erkannt hast und frage nach.
5. Bei einfachen Änderungen (z.B. "ändere Baujahr auf 2008") ist keine Bestätigung nötig — führe es direkt aus.

RECHNUNGSPOSITIONEN:
- MwSt./MWST/USt. Zeilen sind KEINE eigenen Positionen — nicht eintragen!
- "Summe Arbeiten", "Summe Teile", "Nettobetrag", "Zwischensumme" sind KEINE Positionen — nicht eintragen!
- Nur tatsächliche Arbeiten und Teile sind Positionen.

KATEGORIEN bei add_invoice — wähle die passendste:
- oelwechsel: Ölwechsel, Ölfilter, Motoröl, Ölablassschraube
- bremsen: Bremsbeläge, Bremsscheiben, Bremssättel
- reifen: Reifenmontage, Reifenwechsel, Auswuchten, Winterreifen, Sommerreifen
- fahrwerk: Federn, Stoßdämpfer, Federbeine, Achse, Lenkung, Radlager
- auspuff: Auspuff, Krümmer, Katalysator, Abgasanlage
- kuehlung: Kühlwasser, Kühler, Thermostat, Frostschutz, Unterdruckleitung, Kühlmittel
- autoglas: Windschutzscheibe, Autoglas, Scheibenwischer, Frontscheibe, Heckscheibe
- elektrik: Batterie, Lichtmaschine, Starter, Kabel, Sicherungen
- karosserie: Blech, Lack, Rost, Delle, Unfallschaden
- inspektion: Inspektion, Service, Durchsicht, HU-Vorbereitung
- sonstiges: NUR wenn keine andere Kategorie passt (z.B. Lieferspesen, Reinigungsmaterial)

FEEDBACK NACH AKTIONEN:
Wenn du ein Tool erfolgreich ausgeführt hast, fasse IMMER zusammen was du getan hast:
- **Fahrzeug angelegt**: Liste alle eingetragenen Felder auf (Marke, Modell, Baujahr, km, Kennzeichen)
- **Rechnung erfasst**: Liste Werkstatt, Datum, Betrag und alle Positionen auf
- **Wartung eingetragen**: Liste Typ, Beschreibung, Datum, km auf
- **Änderung**: Zeige Vorher → Nachher für jedes geänderte Feld
- **Löschung**: Nenne was genau gelöscht wurde
- **Duplikat erkannt**: Erkläre welcher existierende Eintrag gefunden wurde

Antworte immer auf Deutsch.
Wenn der Benutzer ein Bild schickt, analysiere es und gib die Ergebnisse strukturiert aus.
Halte deine Antworten kurz und hilfreich.`

export const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `Hallo! Ich bin dein Auto-Service Assistent. Ich kann dir helfen mit:

- **Fahrzeuge verwalten** — anlegen, bearbeiten, löschen
- **Dokumente scannen** — Rechnungen, Kaufverträge, Fahrzeugscheine, Service-Hefte
- **Wartungsstatus prüfen** — was ist fällig, was wurde gemacht
- **Fragen beantworten** — Intervalle, Empfehlungen, Kosten

Schick mir einfach eine Nachricht oder ein Foto!`,
}

function createTools(db: RxDatabase, provider: AiProvider, apiKey: string, modelId?: string, imagesBase64?: string[]) {
  return {
    list_vehicles: tool({
      description: 'Listet alle Fahrzeuge auf',
      inputSchema: z.object({}),
      execute: async () => {
        const docs = await (db as any).vehicles.find().exec()
        return docs.map((d: any) => {
          const v = d.toJSON()
          return { id: v.id, make: v.make, model: v.model, year: v.year, mileage: v.mileage, licensePlate: v.licensePlate }
        })
      },
    }),

    add_vehicle: tool({
      description: 'Fügt ein neues Fahrzeug hinzu. Frage nach fehlenden Pflichtfeldern (Marke, Modell, Baujahr).',
      inputSchema: z.object({
        make: z.string().describe('Marke (z.B. BMW, Audi, VW)'),
        model: z.string().describe('Modell (z.B. 320d, A4, Golf)'),
        year: z.number().describe('Baujahr'),
        mileage: z.number().optional().describe('Kilometerstand'),
        licensePlate: z.string().optional().describe('Kennzeichen'),
        vin: z.string().optional().describe('Fahrgestellnummer'),
      }),
      execute: async ({ make, model, year, mileage, licensePlate, vin }) => {
        const now = new Date().toISOString()
        const id = crypto.randomUUID()
        await (db as any).vehicles.insert({
          id,
          make,
          model,
          year,
          mileage: mileage || 0,
          licensePlate: licensePlate || '',
          vin: vin || '',
          createdAt: now,
          updatedAt: now,
        })
        return {
          success: true,
          vehicleId: id,
          message: `Fahrzeug angelegt`,
          data: { make, model, year, mileage: mileage || 0, licensePlate: licensePlate || '', vin: vin || '' },
        }
      },
    }),

    update_vehicle: tool({
      description: 'Aktualisiert Fahrzeug-Daten. Nur die übergebenen Felder werden geändert.',
      inputSchema: z.object({
        vehicleId: z.string().describe('Fahrzeug-ID'),
        make: z.string().optional().describe('Neue Marke'),
        model: z.string().optional().describe('Neues Modell'),
        year: z.number().optional().describe('Neues Baujahr'),
        mileage: z.number().optional().describe('Neuer Kilometerstand'),
        licensePlate: z.string().optional().describe('Neues Kennzeichen'),
        vin: z.string().optional().describe('Neue Fahrgestellnummer'),
      }),
      execute: async ({ vehicleId, make, model, year, mileage, licensePlate, vin }) => {
        const doc = await (db as any).vehicles.findOne({ selector: { id: vehicleId } }).exec()
        if (!doc)
          return { success: false, message: 'Fahrzeug nicht gefunden' }
        const before: Record<string, any> = {}
        const after: Record<string, any> = {}
        const patch: Record<string, any> = { updatedAt: new Date().toISOString() }
        const fields = { make, model, year, mileage, licensePlate, vin } as Record<string, any>
        for (const [key, value] of Object.entries(fields)) {
          if (value !== undefined) {
            before[key] = (doc as any)[key]
            after[key] = value
            patch[key] = value
          }
        }
        await doc.patch(patch)
        return {
          success: true,
          message: `${after.make || doc.make} ${after.model || doc.model} aktualisiert`,
          vehicle: `${doc.make} ${doc.model} (${doc.year})`,
          changes: { before, after },
        }
      },
    }),

    delete_vehicle: tool({
      description: 'Löscht ein Fahrzeug und alle zugehörigen Rechnungen und Wartungen',
      inputSchema: z.object({
        vehicleId: z.string().describe('Fahrzeug-ID'),
      }),
      execute: async ({ vehicleId }) => {
        const doc = await (db as any).vehicles.findOne({ selector: { id: vehicleId } }).exec()
        if (!doc)
          return { success: false, message: 'Fahrzeug nicht gefunden' }
        const name = `${doc.make} ${doc.model}`
        const invoices = await (db as any).invoices.find({ selector: { vehicleId } }).exec()
        for (const inv of invoices) await inv.remove()
        const maintenances = await (db as any).maintenances.find({ selector: { vehicleId } }).exec()
        for (const m of maintenances) await m.remove()
        await doc.remove()
        return {
          success: true,
          message: `Fahrzeug gelöscht`,
          deleted: { vehicle: name, invoices: invoices.length, maintenances: maintenances.length },
        }
      },
    }),

    get_vehicle: tool({
      description: 'Zeigt Details eines Fahrzeugs mit Rechnungen und Wartungshistorie',
      inputSchema: z.object({
        vehicleId: z.string().describe('Fahrzeug-ID'),
      }),
      execute: async ({ vehicleId }) => {
        const doc = await (db as any).vehicles.findOne({ selector: { id: vehicleId } }).exec()
        if (!doc)
          return { error: 'Fahrzeug nicht gefunden' }
        const vehicle = doc.toJSON()
        const invoiceDocs = await (db as any).invoices.find({ selector: { vehicleId } }).exec()
        const maintenanceDocs = await (db as any).maintenances.find({ selector: { vehicleId } }).exec()
        return {
          vehicle: { id: vehicle.id, make: vehicle.make, model: vehicle.model, year: vehicle.year, mileage: vehicle.mileage, licensePlate: vehicle.licensePlate },
          invoices: invoiceDocs.map((d: any) => {
            const i = d.toJSON()
            return { id: i.id, workshopName: i.workshopName, date: i.date, totalAmount: i.totalAmount, items: i.items }
          }),
          maintenances: maintenanceDocs.map((d: any) => {
            const m = d.toJSON()
            return { type: m.type, description: m.description, doneAt: m.doneAt, mileageAtService: m.mileageAtService }
          }),
        }
      },
    }),

    get_maintenance_status: tool({
      description: 'Prüft den Wartungsstatus eines Fahrzeugs - was ist fällig, überfällig oder erledigt',
      inputSchema: z.object({
        vehicleId: z.string().describe('Fahrzeug-ID'),
      }),
      execute: async ({ vehicleId }) => {
        const doc = await (db as any).vehicles.findOne({ selector: { id: vehicleId } }).exec()
        if (!doc)
          return { error: 'Fahrzeug nicht gefunden' }
        const vehicle = doc.toJSON()
        const schedule = getMaintenanceSchedule(vehicle.make, vehicle.model)
        const mDocs = await (db as any).maintenances.find({ selector: { vehicleId } }).exec()
        const lastMaintenances = mDocs.map((d: any) => ({
          type: d.type,
          mileageAtService: d.mileageAtService,
          doneAt: d.doneAt,
        }))
        return checkDueMaintenances({
          currentMileage: vehicle.mileage,
          lastMaintenances,
          schedule,
        })
      },
    }),

    add_invoice: tool({
      description: 'Trägt eine Rechnung manuell ein',
      inputSchema: z.object({
        vehicleId: z.string().describe('Fahrzeug-ID'),
        workshopName: z.string().describe('Name der Werkstatt'),
        date: z.string().describe('Datum im Format YYYY-MM-DD'),
        totalAmount: z.number().describe('Gesamtbetrag'),
        currency: z.string().optional().describe('Währung (z.B. EUR, CHF, USD). Standard: EUR'),
        mileageAtService: z.number().optional().describe('Kilometerstand'),
        imageIndex: z.number().optional().describe('Index des zugehörigen Bildes (0-basiert)'),
        items: z.array(z.object({
          description: z.string().describe('Beschreibung der Arbeit oder des Teils'),
          category: z.enum(MAINTENANCE_CATEGORIES).describe(
            'Kategorie — oelwechsel: Öl/Ölfilter | bremsen: Bremsbeläge/Scheiben | reifen: Reifen/Auswuchten | fahrwerk: Federn/Stoßdämpfer/Achse | auspuff: Auspuff/Katalysator | kuehlung: Kühlwasser/Kühler/Frostschutz/Thermostat | autoglas: Windschutzscheibe/Scheibenwischer | elektrik: Batterie/Kabel | karosserie: Lack/Blech | inspektion: Service/Durchsicht | sonstiges: nur wenn nichts anderes passt',
          ),
          amount: z.number().describe('Einzelbetrag dieser Position'),
        })).describe('Positionen der Rechnung'),
      }),
      execute: async ({ vehicleId, workshopName, date, totalAmount, currency, mileageAtService, imageIndex, items }) => {
        // Duplikat-Prüfung: gleiche Werkstatt + Datum oder gleicher Betrag + Datum
        const existing = await (db as any).invoices.find({ selector: { vehicleId, date } }).exec()
        const duplicate = existing.find((d: any) => {
          const inv = d.toJSON()
          return inv.workshopName === workshopName || inv.totalAmount === totalAmount
        })
        if (duplicate) {
          const d = duplicate.toJSON()
          return {
            success: false,
            message: `Diese Rechnung existiert bereits: ${d.workshopName}, ${d.date}, ${d.totalAmount} ${d.currency || 'EUR'}. Keine doppelte Erfassung.`,
          }
        }

        const now = new Date().toISOString()
        await (db as any).invoices.insert({
          id: crypto.randomUUID(),
          vehicleId,
          workshopName,
          date,
          totalAmount,
          mileageAtService: mileageAtService || 0,
          currency: currency || 'EUR',
          imageData: await (async () => {
            if (!imagesBase64?.length)
              return ''
            // Fallback: wenn Modell keinen imageIndex übergibt, erstes Bild verwenden
            const idx = imageIndex ?? 0
            const raw = imagesBase64[idx] ?? ''
            if (!raw)
              return ''
            return autoRotateForDocument(raw)
          })(),
          rawText: '',
          items,
          createdAt: now,
          updatedAt: now,
        })
        for (const item of items) {
          const normalized = item.category.toLowerCase().trim()
          const aiCategory = (MAINTENANCE_CATEGORIES as readonly string[]).includes(normalized) ? normalized : 'sonstiges'
          const category = correctCategory(item.description, aiCategory)
          await (db as any).maintenances.insert({
            id: crypto.randomUUID(),
            vehicleId,
            invoiceId: '',
            type: category,
            description: item.description,
            doneAt: date,
            mileageAtService: mileageAtService || 0,
            nextDueDate: '',
            nextDueMileage: 0,
            status: 'done',
            createdAt: now,
            updatedAt: now,
          })
        }
        if (mileageAtService) {
          const vDoc = await (db as any).vehicles.findOne({ selector: { id: vehicleId } }).exec()
          if (vDoc && mileageAtService > (vDoc.mileage || 0))
            await vDoc.patch({ mileage: mileageAtService, updatedAt: now })
        }
        return {
          success: true,
          message: `Rechnung erfasst`,
          data: {
            workshopName,
            date,
            totalAmount,
            currency: currency || 'EUR',
            mileageAtService: mileageAtService || 0,
            items: items.map(i => ({ description: i.description, category: i.category, amount: i.amount })),
          },
        }
      },
    }),

    delete_invoice: tool({
      description: 'Löscht eine Rechnung und zugehörige Wartungseinträge',
      inputSchema: z.object({
        invoiceId: z.string().describe('Rechnungs-ID'),
      }),
      execute: async ({ invoiceId }) => {
        const doc = await (db as any).invoices.findOne({ selector: { id: invoiceId } }).exec()
        if (!doc)
          return { success: false, message: 'Rechnung nicht gefunden' }
        const maintenances = await (db as any).maintenances.find({ selector: { invoiceId } }).exec()
        for (const m of maintenances) await m.remove()
        await doc.remove()
        const inv = doc.toJSON()
        return {
          success: true,
          message: `Rechnung gelöscht`,
          deleted: { workshopName: inv.workshopName, date: inv.date, totalAmount: inv.totalAmount, maintenances: maintenances.length },
        }
      },
    }),

    scan_document: tool({
      description: 'Analysiert ein Foto. Erkennt automatisch ob es eine Rechnung, ein Kaufvertrag, ein Fahrzeugschein oder eine Service-Heft-Seite ist. Das Bild muss als base64 übergeben werden.',
      inputSchema: z.object({
        imageBase64: z.string().describe('Base64-kodiertes Bild'),
        documentType: z.string().describe('Art des Dokuments: rechnung, kaufvertrag, fahrzeugschein, serviceheft'),
        vehicleId: z.string().optional().describe('Fahrzeug-ID falls bekannt (nötig für Rechnungen und Service-Hefte)'),
      }),
      execute: async ({ imageBase64, documentType }) => {
        if (documentType === 'rechnung') {
          const result = await parseInvoice(imageBase64, provider, apiKey, modelId, db)
          return { type: 'rechnung', data: result }
        }
        else if (documentType === 'serviceheft') {
          const result = await parseServiceBook(imageBase64, provider, apiKey, modelId, db)
          return { type: 'serviceheft', data: result }
        }
        else {
          const result = await parseVehicleDocument(imageBase64, provider, apiKey, modelId, db)
          return { type: 'fahrzeugdokument', data: result }
        }
      },
    }),
  }
}

export interface ChatOptions {
  provider: AiProvider
  apiKey: string
  model?: string
}

function buildAiMessages(messages: ChatMessage[], imagesBase64?: string[]) {
  return messages
    .filter(m => m.id !== 'welcome')
    .map((m) => {
      if (m.role === 'user' && m === messages[messages.length - 1] && imagesBase64?.length) {
        return {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: m.content || 'Analysiere dieses Bild.' },
            ...imagesBase64.map(img => ({ type: 'image' as const, image: img })),
          ],
        }
      }
      return { role: m.role as 'user' | 'assistant', content: m.content }
    })
}

function formatToolResult(r: any): string | undefined {
  if (!r || typeof r !== 'object')
    return undefined
  const parts: string[] = []
  if (r.message)
    parts.push(String(r.message))
  if (r.data) {
    const d = r.data
    if (d.make)
      parts.push(`Marke: ${d.make}, Modell: ${d.model}, Baujahr: ${d.year}, km: ${d.mileage}${d.licensePlate ? `, Kennzeichen: ${d.licensePlate}` : ''}`)
    if (d.workshopName)
      parts.push(`Werkstatt: ${d.workshopName}, Datum: ${d.date}, Betrag: ${d.totalAmount} ${d.currency}`)
    if (d.items?.length)
      parts.push(`Positionen: ${d.items.map((i: any) => `${i.description} (${i.amount})`).join(', ')}`)
  }
  if (r.changes) {
    const entries = Object.keys(r.changes.before || {})
    for (const key of entries)
      parts.push(`${key}: ${r.changes.before[key]} → ${r.changes.after[key]}`)
  }
  if (r.deleted) {
    const d = r.deleted
    if (d.vehicle)
      parts.push(`Gelöscht: ${d.vehicle}${d.invoices ? ` (${d.invoices} Rechnungen, ${d.maintenances} Wartungen)` : ''}`)
    if (d.workshopName)
      parts.push(`Gelöscht: Rechnung von ${d.workshopName} (${d.date}, ${d.totalAmount})`)
  }
  return parts.length ? parts.join('\n') : undefined
}

function extractResult(result: any): string | undefined {
  if (result.text)
    return result.text
  const allResults = result.steps
    ?.flatMap((s: any) => s.toolResults ?? []) as any[] | undefined
  if (!allResults?.length)
    return undefined
  const messages = allResults
    .map((tr: any) => formatToolResult(tr?.result))
    .filter(Boolean)
  return messages.length ? messages.join('\n') : undefined
}

// Zwischenspeicher für Bilder/PDF-OCR zwischen Phase 1 (Analyse) und Phase 2 (Tool-Calls)
let pendingImages: string[] = []
let pendingPdfOcrTexts: string[] = []

export async function sendChatMessage(
  db: RxDatabase,
  messages: ChatMessage[],
  opts: ChatOptions,
  imagesBase64?: string[],
  pdfBase64?: string,
): Promise<string> {
  const model = getModel({
    provider: opts.provider,
    apiKey: opts.apiKey,
    model: opts.model,
  })

  if (pdfBase64) {
    // Phase 1 für PDF: OCR alle Seiten, dann Ergebnisse anzeigen
    pendingPdfOcrTexts = []
    pendingImages = []

    const ocrPages = await withRetry(() => callMistralOcrPdf(pdfBase64, opts.apiKey))
    pendingPdfOcrTexts = ocrPages

    const ocrContext = ocrPages
      .map((t, i) => `--- Seite ${i + 1} ---\n${t}`)
      .join('\n\n')

    const phase1System = `${SYSTEM_PROMPT}

Der Benutzer hat ein PDF-Dokument mit ${ocrPages.length} Seite(n) hochgeladen.
Jede Seite kann eine separate Rechnung oder ein separates Dokument sein.
Wenn zwei Seiten identisch oder sehr ähnlich sind, weise darauf hin (Duplikat).

--- OCR-ERGEBNIS (exakter Text vom Dokument) ---
${ocrContext}
--- ENDE OCR ---

Der OCR-Text oben ist maschinengelesen und daher bei Zahlen, Tabellen und Beträgen GENAUER als deine eigene Bilderkennung. Verwende die Werte aus dem OCR-Text.

Analysiere jede Seite einzeln. Zeige die erkannten Daten pro Seite strukturiert an — getrennt nach Fahrzeug-Daten und Rechnungs-Daten. Frage den Benutzer ob die Daten korrekt sind bevor du fortfährst.`

    const phase1 = await withRetry(() => generateText({
      model,
      maxRetries: 0,
      system: phase1System,
      messages: buildAiMessages(messages),
      stopWhen: stepCountIs(1),
    }))
    return phase1.text || 'Keine Ergebnisse.'
  }

  if (imagesBase64?.length) {
    // Phase 1: Bilder analysieren — nur Text zurückgeben, NICHTS speichern
    pendingImages = imagesBase64
    pendingPdfOcrTexts = []

    // Mistral: OCR-Vorverarbeitung für perfekte Texterkennung (Tabellen, Spalten, Beträge)
    let ocrTexts: string[] = []
    if (opts.provider === 'mistral') {
      ocrTexts = await Promise.all(
        imagesBase64.map(img => withRetry(() => callMistralOcr(img, opts.apiKey, db)).catch(() => '')),
      )
    }

    const ocrContext = ocrTexts.filter(Boolean).length
      ? `\n\n--- OCR-ERGEBNIS (exakter Text vom Dokument) ---\n${ocrTexts.map((t, i) => `Bild ${i + 1}:\n${t}`).join('\n\n')}\n--- ENDE OCR ---\n\nDer OCR-Text oben ist maschinengelesen und daher bei Zahlen, Tabellen und Beträgen GENAUER als deine eigene Bilderkennung. Verwende die Werte aus dem OCR-Text.`
      : ''

    const phase1System = `${SYSTEM_PROMPT}

Analysiere das Bild sorgfältig. Das Bild kann gedreht sein (90° oder 180°) — lies den Text in der richtigen Leserichtung.

KENNZEICHEN vs. FAHRGESTELLNUMMER:
- Kennzeichen (license plate): Kürzel + Zahlen, z.B. "SG 218574" (Schweizer Kanton St. Gallen), "M-AB 1234". Steht oft neben dem Fahrzeugnamen auf der Rechnung.
- Fahrgestellnummer/VIN: Genau 17 Zeichen, beginnt mit W, V, etc. z.B. "WP1ZZZ9PZ8LA14872"
- "SG 218574" ist ein SCHWEIZER KENNZEICHEN, NICHT eine Fahrgestellnummer!

POSITIONEN KORREKT LESEN:
- Lies die Tabellenspalten sorgfältig: Beschreibung | Menge | Einheit | Einzelpreis | Betrag
- Betrag pro Position = Menge × Einzelpreis. Wenn es nicht aufgeht, hast du falsch gelesen.
- "Summe Arbeiten" und "Summe Teile" sind Zwischensummen — KEINE eigenen Positionen
- Kontrolliere: Summe aller Positions-Beträge ≈ Netto-Gesamtbetrag (vor MwSt.)
- Wenn die Summe nicht stimmt, lies die Tabelle nochmal und korrigiere.

WÄHRUNG:
- "CHF" oder "Totalbetrag CHF" → CHF (Schweizer Franken)
- "€" oder "EUR" → EUR
${ocrContext}

Zeige die erkannten Daten strukturiert an — getrennt nach Fahrzeug-Daten und Rechnungs-Daten. Frage den Benutzer ob die Daten korrekt sind bevor du fortfährst.`

    // Vision-Modell: max 8 Bilder. Bei >8 nur OCR-Text verwenden (kein Bild im Request)
    const visionImages = imagesBase64.length <= 8 ? imagesBase64 : undefined

    const phase1 = await withRetry(() => generateText({
      model,
      maxRetries: 0,
      system: phase1System,
      messages: buildAiMessages(messages, visionImages),
      stopWhen: stepCountIs(1),
    }))
    return phase1.text || 'Keine Ergebnisse.'
  }

  // Phase 2: Wenn Bilder oder PDF-OCR aus vorheriger Nachricht zwischengespeichert sind
  const storedImages = pendingImages.length ? [...pendingImages] : undefined
  const storedPdfOcr = pendingPdfOcrTexts.length ? [...pendingPdfOcrTexts] : undefined
  if (storedImages?.length)
    pendingImages = []
  if (storedPdfOcr?.length)
    pendingPdfOcrTexts = []

  const allTools = createTools(db, opts.provider, opts.apiKey, opts.model, storedImages)
  const { scan_document: _, ...toolsWithoutScan } = allTools
  const tools = (storedImages?.length || storedPdfOcr?.length) ? toolsWithoutScan : allTools

  // Fahrzeugliste für Kontext — IMMER injizieren, nicht nur bei Bildern
  const vehicleDocs = await (db as any).vehicles.find().exec()
  const vehicleList = vehicleDocs.map((d: any) => {
    const v = d.toJSON()
    return `- ${v.make} ${v.model} (${v.year}), ${v.mileage} km${v.licensePlate ? `, ${v.licensePlate}` : ''}: ID=${v.id}`
  }).join('\n')

  const vehicleContext = vehicleList
    ? `Verfügbare Fahrzeuge:\n${vehicleList}`
    : '(keine Fahrzeuge vorhanden — lege zuerst eins an mit add_vehicle)'

  const aiMessages = buildAiMessages(messages)

  // Kontext immer anhängen, damit das Modell Fahrzeuge ohne ID-Nachfrage zuordnen kann
  if (storedPdfOcr?.length) {
    const pdfContext = storedPdfOcr
      .map((t, i) => `--- Seite ${i + 1} ---\n${t}`)
      .join('\n\n')
    aiMessages.push({
      role: 'user' as any,
      content: `Kontext: PDF mit ${storedPdfOcr.length} Seite(n) wurde analysiert. Jede Seite kann eine separate Rechnung sein. Trage jede Rechnung einzeln ein.\n\n--- OCR-TEXT ---\n${pdfContext}\n--- ENDE ---\n\n${vehicleContext}\n\nWICHTIG: Verwende NUR die exakten Fahrzeug-IDs aus der Liste oben oder aus dem Ergebnis von add_vehicle. Erfinde KEINE IDs.`,
    })
  }
  else if (storedImages?.length) {
    aiMessages.push({
      role: 'user' as any,
      content: `Kontext: Es wurden ${storedImages.length} Bilder gesendet (Index 0–${storedImages.length - 1}). Nutze imageIndex bei add_invoice um das Bild zu speichern.\n\n${vehicleContext}\n\nWICHTIG: Verwende NUR die exakten Fahrzeug-IDs aus der Liste oben oder aus dem Ergebnis von add_vehicle. Erfinde KEINE IDs.`,
    })
  }
  else {
    aiMessages.push({
      role: 'user' as any,
      content: `[System-Kontext] ${vehicleContext}`,
    })
  }

  // Mehr Steps für PDF mit vielen Seiten (jede Seite = mind. 1 add_invoice + 1 add_vehicle)
  const maxSteps = storedPdfOcr?.length ? Math.max(5, storedPdfOcr.length * 2 + 2) : 5

  const result = await withRetry(() => generateText({
    model,
    maxRetries: 0,
    system: SYSTEM_PROMPT,
    messages: aiMessages,
    tools,
    stopWhen: stepCountIs(maxSteps),
  }))
  return extractResult(result) || 'Erledigt.'
}
