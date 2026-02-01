import type { RxDatabase } from 'rxdb'
import type { AiProvider } from '../stores/settings'
import { generateText, stepCountIs, tool } from 'ai'
import { z } from 'zod'
import { getModel, MAINTENANCE_CATEGORIES, parseInvoice, parseServiceBook, parseVehicleDocument, withRetry } from './ai'
import { checkDueMaintenances, getMaintenanceSchedule } from './maintenance-schedule'

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

WICHTIGE REGELN:
1. Bevor du ein Fahrzeug anlegst, zeige ALLE Felder dem Benutzer und warte auf Bestätigung:
   - Marke, Modell, Baujahr, Kilometerstand, Kennzeichen, Fahrgestellnummer
2. Bevor du eine Rechnung einträgst, zeige ALLE Felder dem Benutzer und warte auf Bestätigung:
   - Werkstatt, Datum, Gesamtbetrag, Währung, Kilometerstand, alle Positionen (Beschreibung, Kategorie, Betrag)
3. Führe KEINE Tools aus bevor der Benutzer die Daten bestätigt hat.
4. Wenn du unsicher bist über ein Feld, zeige was du erkannt hast und frage nach.

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
        return { success: true, vehicleId: id, message: `${make} ${model} (${year}) wurde angelegt. Fahrzeug-ID: ${id}` }
      },
    }),

    update_vehicle: tool({
      description: 'Aktualisiert Fahrzeug-Daten (z.B. Kilometerstand, Kennzeichen)',
      inputSchema: z.object({
        vehicleId: z.string().describe('Fahrzeug-ID'),
        mileage: z.number().optional().describe('Neuer Kilometerstand'),
        licensePlate: z.string().optional().describe('Neues Kennzeichen'),
      }),
      execute: async ({ vehicleId, mileage, licensePlate }) => {
        const doc = await (db as any).vehicles.findOne({ selector: { id: vehicleId } }).exec()
        if (!doc)
          return { success: false, message: 'Fahrzeug nicht gefunden' }
        const patch: Record<string, any> = { updatedAt: new Date().toISOString() }
        if (mileage !== undefined)
          patch.mileage = mileage
        if (licensePlate !== undefined)
          patch.licensePlate = licensePlate
        await doc.patch(patch)
        return { success: true, message: 'Fahrzeug aktualisiert.' }
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
        return { success: true, message: `${name} und alle zugehörigen Daten wurden gelöscht.` }
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
          description: z.string(),
          category: z.string(),
          amount: z.number(),
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
          imageData: (imagesBase64 && imageIndex !== undefined) ? imagesBase64[imageIndex] ?? '' : '',
          rawText: '',
          items,
          createdAt: now,
          updatedAt: now,
        })
        for (const item of items) {
          const normalized = item.category.toLowerCase().trim()
          const category = (MAINTENANCE_CATEGORIES as readonly string[]).includes(normalized) ? normalized : 'sonstiges'
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
          if (vDoc)
            await vDoc.patch({ mileage: mileageAtService, updatedAt: now })
        }
        return { success: true, message: `Rechnung von ${workshopName} gespeichert.` }
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
        return { success: true, message: 'Rechnung gelöscht.' }
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
          const result = await parseInvoice(imageBase64, provider, apiKey, modelId)
          return { type: 'rechnung', data: result }
        }
        else if (documentType === 'serviceheft') {
          const result = await parseServiceBook(imageBase64, provider, apiKey, modelId)
          return { type: 'serviceheft', data: result }
        }
        else {
          const result = await parseVehicleDocument(imageBase64, provider, apiKey, modelId)
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

function extractResult(result: any): string | undefined {
  if (result.text)
    return result.text
  const allResults = result.steps
    ?.flatMap((s: any) => s.toolResults ?? []) as any[] | undefined
  if (!allResults?.length)
    return undefined
  const messages = allResults
    .map((tr: any) => {
      const r = tr?.result
      if (r && typeof r === 'object' && (r as any).message)
        return String((r as any).message)
      return undefined
    })
    .filter(Boolean)
  return messages.length ? messages.join('\n') : undefined
}

// Zwischenspeicher für Bilder zwischen Phase 1 (Analyse) und Phase 2 (Tool-Calls)
let pendingImages: string[] = []

export async function sendChatMessage(
  db: RxDatabase,
  messages: ChatMessage[],
  opts: ChatOptions,
  imagesBase64?: string[],
): Promise<string> {
  const model = getModel({
    provider: opts.provider,
    apiKey: opts.apiKey,
    model: opts.model,
  })

  if (imagesBase64?.length) {
    // Phase 1: Bilder analysieren — nur Text zurückgeben, NICHTS speichern
    pendingImages = imagesBase64
    const phase1 = await withRetry(() => generateText({
      model,
      maxRetries: 0,
      system: `${SYSTEM_PROMPT}\n\nBeschreibe detailliert was du auf dem Bild/den Bildern siehst. Zeige die erkannten Daten strukturiert an — getrennt nach Fahrzeug-Daten und Rechnungs-Daten, so wie sie eingetragen werden würden. Frage den Benutzer ob die Daten korrekt sind bevor du fortfährst.`,
      messages: buildAiMessages(messages, imagesBase64),
      stopWhen: stepCountIs(1),
    }))
    return phase1.text || 'Keine Ergebnisse.'
  }

  // Phase 2: Wenn Bilder aus vorheriger Nachricht zwischengespeichert sind
  const storedImages = pendingImages.length ? [...pendingImages] : undefined
  if (storedImages?.length)
    pendingImages = []

  const allTools = createTools(db, opts.provider, opts.apiKey, opts.model, storedImages)
  const { scan_document: _, ...toolsWithoutScan } = allTools
  const tools = storedImages?.length ? toolsWithoutScan : allTools

  // Fahrzeugliste für Kontext
  const vehicleDocs = await (db as any).vehicles.find().exec()
  const vehicleList = vehicleDocs.map((d: any) => {
    const v = d.toJSON()
    return `- ${v.make} ${v.model} (${v.year}): ID=${v.id}`
  }).join('\n')

  const aiMessages = buildAiMessages(messages)

  // Kontext-Hinweis für Tool-Calls anhängen
  if (storedImages?.length) {
    aiMessages.push({
      role: 'user' as any,
      content: `Kontext: Es wurden ${storedImages.length} Bilder gesendet (Index 0–${storedImages.length - 1}). Nutze imageIndex bei add_invoice um das Bild zu speichern.\n\nVerfügbare Fahrzeuge:\n${vehicleList || '(keine — lege zuerst ein Fahrzeug an mit add_vehicle, dann nutze die zurückgegebene vehicleId für add_invoice)'}\n\nWICHTIG: Verwende NUR die exakten Fahrzeug-IDs aus der Liste oben oder aus dem Ergebnis von add_vehicle. Erfinde KEINE IDs.`,
    })
  }

  const result = await withRetry(() => generateText({
    model,
    maxRetries: 0,
    system: SYSTEM_PROMPT,
    messages: aiMessages,
    tools,
    stopWhen: stepCountIs(5),
  }))
  return extractResult(result) || 'Erledigt.'
}
