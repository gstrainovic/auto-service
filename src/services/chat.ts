import type { AiAccess } from './ai-access'
import { generateText, stepCountIs, tool } from 'ai'
import { z } from 'zod'
import { getCurrentUserId } from '../composables/useAuth'
import { autoRotateForDocument } from '../composables/useImageResize'
import { db, id as instantId, tx } from '../lib/instantdb'
import { callMistralOcr, callMistralOcrPdf, getModel, hashImage, MAINTENANCE_CATEGORIES, parseInvoice, parseServiceBook, parseVehicleDocument, withRetry } from './ai'
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

export interface ToolResult {
  tool: string
  data: Record<string, any>
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  attachment?: { type: 'image' | 'pdf', name: string, preview?: string }
  attachments?: { type: 'image' | 'pdf', name: string, preview?: string }[]
  toolResults?: ToolResult[]
}

const SYSTEM_PROMPT = `Du bist der Auto-Service Assistent. Du hilfst beim Verwalten von Fahrzeugen und Wartungen.
Deine Fähigkeiten:
- Fahrzeuge anlegen, bearbeiten, löschen
- Rechnungen und Wartungen eintragen
- Fotos von Rechnungen, Kaufverträgen, Fahrzeugscheinen und Service-Heften analysieren
- Wartungsstatus prüfen und Empfehlungen geben
- Fragen zu Wartungsintervallen beantworten
- OCR-Texte gespeicherter Rechnungen abrufen (get_ocr_text) — enthält den maschinengelesenen Volltext

FAHRZEUG-ERKENNUNG:
- Der Benutzer kennt KEINE IDs. Er sagt z.B. "mein BMW", "der Golf", "das Fahrzeug".
- Du bekommst die Fahrzeugliste automatisch als Kontext. Nutze sie um das richtige Fahrzeug zu identifizieren.
- Wenn nur EIN Fahrzeug existiert, verwende es automatisch ohne nachzufragen.
- Wenn MEHRERE Fahrzeuge passen könnten, frage kurz nach: "Meinst du den BMW 320d oder den BMW X3?"
- Rufe NIEMALS den Benutzer auf eine ID zu nennen.

WICHTIGE REGELN:
1. Bevor du ein Fahrzeug anlegst, zeige die Felder dem Benutzer und warte auf Bestätigung:
   - Marke, Modell, Baujahr, Kilometerstand, Kennzeichen, Fahrgestellnummer
   - Kennzeichen und Fahrgestellnummer sind OPTIONAL: Wenn nicht genannt, zeige "nicht angegeben" und frage NICHT danach.
2. Bevor du eine Rechnung einträgst, zeige ALLE Felder dem Benutzer und warte auf Bestätigung:
   - Werkstatt, Datum, Gesamtbetrag, Währung, Kilometerstand, alle Positionen (Beschreibung, Kategorie, Betrag)
3. Führe add_vehicle und add_invoice NICHT aus bevor der Benutzer die Daten bestätigt hat.
4. Wenn du unsicher bist über ein Feld, zeige was du erkannt hast und frage nach.
5. Bei einfachen Änderungen (z.B. "ändere Baujahr auf 2008") ist keine Bestätigung nötig — führe es direkt aus.
6. Sobald der Benutzer bestätigt ("Ja", "passt", "eintragen", "ok", "mach das"), rufe SOFORT das Tool auf.
   Frage NIEMALS ein zweites Mal nach Bestätigung und stelle keine Rückfragen zu optionalen Feldern.
7. Aktionen passieren AUSSCHLIESSLICH über Tool-Aufrufe. Schreibe NIEMALS "wurde angelegt/eingetragen/gespeichert",
   wenn du das entsprechende Tool nicht in diesem Schritt aufgerufen hast — das wäre eine Falschaussage.

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

WARTUNG OHNE RECHNUNG:
- Wenn der Benutzer eine erledigte Wartung melden will OHNE Rechnung/Beleg, verwende add_maintenance (NICHT add_invoice).
- add_invoice ist NUR für Rechnungen mit Werkstatt, Betrag und Positionen gedacht.
- add_maintenance ist für einfache Wartungseinträge (z.B. "Ölwechsel gemacht", "Reifen gewechselt").
- Sind Fahrzeug, Art und Datum klar, rufe add_maintenance DIREKT auf — ohne Bestätigungsrunde und ohne Erfolgsmeldung vorab.

FEEDBACK NACH AKTIONEN (gilt NUR für den Text NACH einem erfolgreichen Tool-Aufruf):
Die Tool-Ergebnisse werden automatisch als strukturierte Cards angezeigt. Wiederhole die Daten NICHT nochmal als Liste!
Schreibe stattdessen eine KURZE Bestätigung (1-2 Sätze) mit einem passenden Emoji (🚗 Fahrzeug, 🧾 Rechnung, 🔧 Wartung, ✏️ Änderung, 🗑️ Löschung).
Bei Änderungen nur die geänderten Werte nennen (alt → neu). Bei erkannten Duplikaten (⚠️) erklären, welcher Eintrag bereits existiert.
Diese Bestätigung ist NUR erlaubt, wenn in diesem Schritt ein Tool-Ergebnis vorliegt.
WICHTIG: Keine Listen mit Marke/Modell/Baujahr/etc. — das steht alles in der Card!

WARTUNGSPLAN AUS SERVICE-HEFT:
- Wenn der Benutzer Fotos aus dem Service-Heft/Wartungsplan schickt:
  1. Lies die Intervalle sorgfältig ab (km und Zeitintervalle)
  2. Mappe zu Kategorien: oelwechsel, inspektion, bremsen, reifen, luftfilter, zahnriemen, bremsflüssigkeit, klimaanlage, tuev, kuehlung, fahrwerk, elektrik, sonstiges
  3. Zeige dem Benutzer eine Tabelle mit allen erkannten Intervallen
  4. Nach Bestätigung: verwende IMMER set_maintenance_schedule (NICHT add_maintenance!)
  WICHTIG: set_maintenance_schedule setzt die INTERVALLE (z.B. "Ölwechsel alle 15.000 km").
  add_maintenance ist NUR für einzelne erledigte Wartungseinträge (z.B. "Ölwechsel am 15.03.2024").
  Beim Service-Heft-Upload geht es um INTERVALLE → set_maintenance_schedule verwenden!
- Typische Zuordnung:
  - Zündkerzen → elektrik
  - Getriebeöl/Differentialöl/Verteilergetriebeöl → sonstiges (Label beschreibt es genau)
  - Kleine Wartung/Inspektion → inspektion
  - Antriebsriemen/Keilriemen → zahnriemen
  - Kühlmittel/Frostschutz → kuehlung
  - Reifendichtmittel → reifen

HINWEIS AUF SERVICE-HEFT:
- Wenn ein Fahrzeug KEINEN fahrzeugspezifischen Wartungsplan hat (customSchedule fehlt), weise den Benutzer darauf hin:
  - Der aktuelle Wartungsplan basiert auf allgemeinen/markenbasierten Intervallen
  - Für genauere, fahrzeugspezifische Intervalle sollte er sein Service-Heft fotografieren und hochladen
  - Dann werden die Hersteller-Intervalle für sein konkretes Modell hinterlegt
- Zeige diesen Hinweis:
  - Proaktiv, wenn über ein Fahrzeug ohne customSchedule gesprochen wird (z.B. bei get_vehicle, get_maintenance_status)
  - Aber NICHT wiederholt — einmal pro Gespräch pro Fahrzeug reicht
- Formulierung z.B.: "💡 Tipp: Der Wartungsplan für deinen [Marke Modell] basiert auf allgemeinen Intervallen. Fotografiere dein Service-Heft und schick mir die Bilder — dann hinterlege ich die genauen Hersteller-Intervalle für dein Fahrzeug."

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

function createTools(access: AiAccess, modelId?: string, imagesBase64?: string[]) {
  return {
    list_vehicles: tool({
      description: 'Listet alle Fahrzeuge auf',
      inputSchema: z.object({}),
      execute: async () => {
        const result = await db.queryOnce({ vehicles: {} })
        const vehicles = result.data.vehicles || []
        return vehicles.map((v: any) => ({
          id: v.id,
          make: v.make,
          model: v.model,
          year: v.year,
          mileage: v.mileage,
          licensePlate: v.licensePlate,
        }))
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
        const now = Date.now()
        const vehicleId = instantId()
        await db.transact([
          tx.vehicles[vehicleId].update({
            make,
            model,
            year,
            mileage: mileage || 0,
            licensePlate: licensePlate || '',
            vin: vin || '',
            creatorId: getCurrentUserId(),
            createdAt: now,
          }),
        ])
        return {
          success: true,
          vehicleId,
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
        const result = await db.queryOnce({ vehicles: {} })
        const vehicles = result.data.vehicles || []
        const vehicle = vehicles.find((v: any) => v.id === vehicleId)
        if (!vehicle)
          return { success: false, message: 'Fahrzeug nicht gefunden' }
        const before: Record<string, any> = {}
        const after: Record<string, any> = {}
        const patch: Record<string, any> = {}
        const fields = { make, model, year, mileage, licensePlate, vin } as Record<string, any>
        for (const [key, value] of Object.entries(fields)) {
          if (value !== undefined) {
            before[key] = (vehicle as any)[key]
            after[key] = value
            patch[key] = value
          }
        }
        await db.transact([tx.vehicles[vehicleId].update(patch)])
        return {
          success: true,
          message: `${after.make || vehicle.make} ${after.model || vehicle.model} aktualisiert`,
          vehicle: `${vehicle.make} ${vehicle.model} (${vehicle.year})`,
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
        const result = await db.queryOnce({ vehicles: {}, invoices: {}, maintenances: {} })
        const vehicles = result.data.vehicles || []
        const vehicle = vehicles.find((v: any) => v.id === vehicleId)
        if (!vehicle)
          return { success: false, message: 'Fahrzeug nicht gefunden' }
        const name = `${vehicle.make} ${vehicle.model}`
        const invoices = (result.data.invoices || []).filter((i: any) => i.vehicleId === vehicleId)
        const maintenances = (result.data.maintenances || []).filter((m: any) => m.vehicleId === vehicleId)
        const transactions = [
          ...invoices.map((i: any) => tx.invoices[i.id].delete()),
          ...maintenances.map((m: any) => tx.maintenances[m.id].delete()),
          tx.vehicles[vehicleId].delete(),
        ]
        await db.transact(transactions)
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
        const result = await db.queryOnce({ vehicles: {}, invoices: {}, maintenances: {} })
        const vehicles = result.data.vehicles || []
        const vehicle = vehicles.find((v: any) => v.id === vehicleId)
        if (!vehicle)
          return { error: 'Fahrzeug nicht gefunden' }
        const invoices = (result.data.invoices || []).filter((i: any) => i.vehicleId === vehicleId)
        const maintenances = (result.data.maintenances || []).filter((m: any) => m.vehicleId === vehicleId)
        return {
          vehicle: { id: vehicle.id, make: vehicle.make, model: vehicle.model, year: vehicle.year, mileage: vehicle.mileage, licensePlate: vehicle.licensePlate, hasCustomSchedule: !!vehicle.customSchedule?.length },
          invoices: invoices.map((i: any) => ({
            id: i.id,
            workshopName: i.workshopName,
            date: i.date,
            totalAmount: i.totalAmount,
            items: i.items,
            hasOcrText: !!i.ocrCacheId,
          })),
          maintenances: maintenances.map((m: any) => ({
            type: m.type,
            description: m.description,
            doneAt: m.doneAt,
            mileageAtService: m.mileageAtService,
          })),
        }
      },
    }),

    get_maintenance_status: tool({
      description: 'Prüft den Wartungsstatus eines Fahrzeugs - was ist fällig, überfällig oder erledigt',
      inputSchema: z.object({
        vehicleId: z.string().describe('Fahrzeug-ID'),
      }),
      execute: async ({ vehicleId }) => {
        const result = await db.queryOnce({ vehicles: {}, maintenances: {} })
        const vehicles = result.data.vehicles || []
        const vehicle = vehicles.find((v: any) => v.id === vehicleId)
        if (!vehicle)
          return { error: 'Fahrzeug nicht gefunden' }
        const schedule = getMaintenanceSchedule(vehicle.customSchedule)
        const maintenances = (result.data.maintenances || []).filter((m: any) => m.vehicleId === vehicleId)
        const lastMaintenances = maintenances.map((m: any) => ({
          type: m.type,
          mileageAtService: m.mileageAtService,
          doneAt: m.doneAt,
        }))
        const status = checkDueMaintenances({
          currentMileage: vehicle.mileage,
          lastMaintenances,
          schedule,
        })
        return {
          ...status,
          hasCustomSchedule: !!vehicle.customSchedule?.length,
          vehicle: `${vehicle.make} ${vehicle.model}`,
        }
      },
    }),

    set_maintenance_schedule: tool({
      description: 'Setzt den Wartungsplan eines Fahrzeugs basierend auf Hersteller-Angaben aus dem Service-Heft',
      inputSchema: z.object({
        vehicleId: z.string().describe('Fahrzeug-ID'),
        schedule: z.array(z.object({
          type: z.enum(MAINTENANCE_CATEGORIES).describe('Wartungskategorie'),
          label: z.string().describe('Beschreibung z.B. "Motoröl + Ölfilter"'),
          intervalKm: z.number().describe('km-Intervall (0 wenn nur zeitbasiert)'),
          intervalMonths: z.number().describe('Monats-Intervall'),
        })).describe('Wartungsintervalle aus dem Service-Heft'),
      }),
      execute: async ({ vehicleId, schedule }) => {
        const result = await db.queryOnce({ vehicles: {} })
        const vehicles = result.data.vehicles || []
        const vehicle = vehicles.find((v: any) => v.id === vehicleId)
        if (!vehicle)
          return { error: 'Fahrzeug nicht gefunden' }
        await db.transact([tx.vehicles[vehicleId].update({ customSchedule: schedule })])
        return {
          success: true,
          message: `Wartungsplan für ${vehicle.make} ${vehicle.model} gespeichert (${schedule.length} Positionen)`,
          schedule: schedule.map(s => ({
            label: s.label,
            interval: `${s.intervalKm > 0 ? `${s.intervalKm.toLocaleString()} km` : ''}${s.intervalKm > 0 && s.intervalMonths > 0 ? ' / ' : ''}${s.intervalMonths > 0 ? `${s.intervalMonths} Monate` : ''}`,
          })),
        }
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
        const result = await db.queryOnce({ invoices: {}, vehicles: {} })
        const existingInvoices = (result.data.invoices || []).filter((i: any) => i.vehicleId === vehicleId && i.date === date)
        const duplicate = existingInvoices.find((inv: any) => inv.workshopName === workshopName || inv.totalAmount === totalAmount)
        if (duplicate) {
          return {
            success: false,
            message: `Diese Rechnung existiert bereits: ${duplicate.workshopName}, ${duplicate.date}, ${duplicate.totalAmount} ${duplicate.currency || 'EUR'}. Keine doppelte Erfassung.`,
          }
        }

        const now = Date.now()
        const imgRaw = imagesBase64?.length ? (imagesBase64[imageIndex ?? 0] ?? '') : ''
        const imageData = imgRaw ? await autoRotateForDocument(imgRaw) : ''
        const ocrCacheId = imgRaw ? await hashImage(imgRaw) : ''
        const invoiceId = instantId()

        const transactions: any[] = [
          tx.invoices[invoiceId].update({
            vehicleId,
            workshopName,
            date,
            totalAmount,
            mileageAtService: mileageAtService || 0,
            currency: currency || 'EUR',
            imageData,
            ocrCacheId,
            items,
            creatorId: getCurrentUserId(),
            createdAt: now,
          }),
        ]

        for (const item of items) {
          const normalized = item.category.toLowerCase().trim()
          const aiCategory = (MAINTENANCE_CATEGORIES as readonly string[]).includes(normalized) ? normalized : 'sonstiges'
          const category = correctCategory(item.description, aiCategory)
          const maintenanceId = instantId()
          transactions.push(
            tx.maintenances[maintenanceId].update({
              vehicleId,
              invoiceId: '',
              type: category,
              description: item.description,
              doneAt: date,
              mileageAtService: mileageAtService || 0,
              nextDueDate: '',
              nextDueMileage: 0,
              status: 'done',
              creatorId: getCurrentUserId(),
              createdAt: now,
            }),
          )
        }

        if (mileageAtService) {
          const vehicles = result.data.vehicles || []
          const vehicle = vehicles.find((v: any) => v.id === vehicleId)
          if (vehicle && mileageAtService > (vehicle.mileage || 0))
            transactions.push(tx.vehicles[vehicleId].update({ mileage: mileageAtService }))
        }

        await db.transact(transactions)
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
        const result = await db.queryOnce({ invoices: {}, maintenances: {} })
        const invoices = result.data.invoices || []
        const invoice = invoices.find((i: any) => i.id === invoiceId)
        if (!invoice)
          return { success: false, message: 'Rechnung nicht gefunden' }
        const maintenances = (result.data.maintenances || []).filter((m: any) => m.invoiceId === invoiceId)
        const transactions = [
          ...maintenances.map((m: any) => tx.maintenances[m.id].delete()),
          tx.invoices[invoiceId].delete(),
        ]
        await db.transact(transactions)
        return {
          success: true,
          message: `Rechnung gelöscht`,
          deleted: { workshopName: invoice.workshopName, date: invoice.date, totalAmount: invoice.totalAmount, maintenances: maintenances.length },
        }
      },
    }),

    get_ocr_text: tool({
      description: 'Liest den OCR-Text einer Rechnung aus dem Cache. Nützlich um Details einer gespeicherten Rechnung nachzuschlagen.',
      inputSchema: z.object({
        invoiceId: z.string().describe('Rechnungs-ID'),
      }),
      execute: async ({ invoiceId }) => {
        const result = await db.queryOnce({ invoices: {}, ocrcache: {} })
        const invoices = result.data.invoices || []
        const invoice = invoices.find((i: any) => i.id === invoiceId)
        if (!invoice)
          return { error: 'Rechnung nicht gefunden' }
        if (!invoice.ocrCacheId)
          return { error: 'Kein OCR-Text für diese Rechnung vorhanden' }
        const ocrEntries = result.data.ocrcache || []
        const ocrEntry = ocrEntries.find((o: any) => o.hash === invoice.ocrCacheId)
        if (!ocrEntry)
          return { error: 'OCR-Cache-Eintrag nicht gefunden' }
        return { invoiceId, ocrText: ocrEntry.markdown }
      },
    }),

    add_maintenance: tool({
      description: 'Trägt eine Wartung OHNE Rechnung ein. Verwende dies wenn der Benutzer eine erledigte Wartung melden will aber keine Rechnung hat.',
      inputSchema: z.object({
        vehicleId: z.string().describe('Fahrzeug-ID'),
        type: z.enum(MAINTENANCE_CATEGORIES).describe(
          'Kategorie — oelwechsel, bremsen, reifen, fahrwerk, auspuff, kuehlung, autoglas, elektrik, karosserie, inspektion, klimaanlage, zahnriemen, bremsflüssigkeit, luftfilter, tuev, sonstiges',
        ),
        description: z.string().describe('Beschreibung der Wartung'),
        doneAt: z.string().describe('Datum im Format YYYY-MM-DD'),
        mileageAtService: z.number().optional().describe('Kilometerstand bei der Wartung'),
      }),
      execute: async ({ vehicleId, type, description, doneAt, mileageAtService }) => {
        const result = await db.queryOnce({ vehicles: {} })
        const vehicles = result.data.vehicles || []
        const vehicle = vehicles.find((v: any) => v.id === vehicleId)
        if (!vehicle)
          return { success: false, message: 'Fahrzeug nicht gefunden' }

        const category = correctCategory(description, type)
        const maintenanceId = instantId()
        const transactions: any[] = [
          tx.maintenances[maintenanceId].update({
            vehicleId,
            invoiceId: '',
            type: category,
            description,
            doneAt,
            mileageAtService: mileageAtService || 0,
            nextDueDate: '',
            nextDueMileage: 0,
            status: 'done',
            creatorId: getCurrentUserId(),
            createdAt: Date.now(),
          }),
        ]

        if (mileageAtService && mileageAtService > (vehicle.mileage || 0))
          transactions.push(tx.vehicles[vehicleId].update({ mileage: mileageAtService }))

        await db.transact(transactions)
        return {
          success: true,
          message: `Wartung eingetragen`,
          data: {
            type: category,
            description,
            doneAt,
            mileageAtService: mileageAtService || 0,
            vehicle: `${vehicle.make} ${vehicle.model}`,
          },
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
          const result = await parseInvoice(imageBase64, access, modelId)
          return { type: 'rechnung', data: result }
        }
        else if (documentType === 'serviceheft') {
          const result = await parseServiceBook(imageBase64, access, modelId)
          return { type: 'serviceheft', data: result }
        }
        else {
          const result = await parseVehicleDocument(imageBase64, access, modelId)
          return { type: 'fahrzeugdokument', data: result }
        }
      },
    }),
  }
}

export interface ChatOptions {
  access: AiAccess
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
    if (d.type && d.doneAt && !d.workshopName)
      parts.push(`Typ: ${d.type}, Beschreibung: ${d.description}, Datum: ${d.doneAt}${d.mileageAtService ? `, km: ${d.mileageAtService}` : ''}`)
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

function extractResult(result: any): { text?: string, toolResults?: ToolResult[] } {
  const toolResults: ToolResult[] = []
  const allStepResults = result.steps
    ?.flatMap((s: any) => s.toolResults ?? []) as any[] | undefined
  if (allStepResults?.length) {
    for (const tr of allStepResults) {
      // AI SDK v6: tool results have .output (not .result)
      const output = tr?.output ?? tr?.result
      if (!output?.success || !tr?.toolName)
        continue
      if (output.data) {
        toolResults.push({ tool: tr.toolName, data: output.data })
      }
      else if (output.schedule) {
        // set_maintenance_schedule: schedule array als data
        toolResults.push({ tool: tr.toolName, data: { schedule: output.schedule, message: output.message } })
      }
    }
  }

  if (result.text)
    return { text: result.text, toolResults: toolResults.length ? toolResults : undefined }

  const messages = (allStepResults ?? [])
    .map((tr: any) => formatToolResult(tr?.output ?? tr?.result))
    .filter(Boolean)
  const text = messages.length ? messages.join('\n') : undefined
  return { text, toolResults: toolResults.length ? toolResults : undefined }
}

// Zwischenspeicher für Bilder/PDF-OCR zwischen Phase 1 (Analyse) und Phase 2 (Tool-Calls)
let pendingImages: string[] = []
let pendingPdfOcrTexts: string[] = []

export async function sendChatMessage(
  messages: ChatMessage[],
  opts: ChatOptions,
  imagesBase64?: string[],
  pdfBase64s?: string[],
): Promise<{ text: string, toolResults?: ToolResult[] }> {
  const model = getModel({
    access: opts.access,
    model: opts.model,
  })

  if (pdfBase64s?.length) {
    // Phase 1 für PDF(s): OCR alle Seiten aller PDFs, dann Ergebnisse anzeigen
    pendingPdfOcrTexts = []
    pendingImages = []

    const allOcrPages: string[] = []
    for (const pdfBase64 of pdfBase64s) {
      const ocrPages = await withRetry(() => callMistralOcrPdf(pdfBase64, opts.access))
      allOcrPages.push(...ocrPages)
    }
    const ocrPages = allOcrPages
    pendingPdfOcrTexts = ocrPages

    const ocrContext = ocrPages
      .map((t, i) => `--- Seite ${i + 1} ---\n${t}`)
      .join('\n\n')

    const phase1System = `${SYSTEM_PROMPT}

Der Benutzer hat ein PDF-Dokument mit ${ocrPages.length} Seite(n) hochgeladen.
Jede Seite kann eine separate Rechnung, ein Service-Heft, ein Kaufvertrag oder ein anderes Dokument sein.
Wenn zwei Seiten identisch oder sehr ähnlich sind, weise darauf hin (Duplikat).

Bestimme ZUERST den Dokumenttyp jeder Seite:
- **Rechnung**: Werkstattname, Beträge, Positionen mit Preisen
- **Service-Heft/Wartungsplan**: Wartungsintervalle, Inspektionsplan, Wartungsnachweis
- **Kaufvertrag/Fahrzeugschein**: Fahrzeugdaten, Halter, Erstzulassung

--- OCR-ERGEBNIS (exakter Text vom Dokument) ---
${ocrContext}
--- ENDE OCR ---

Der OCR-Text oben ist maschinengelesen und daher bei Zahlen, Tabellen und Beträgen GENAUER als deine eigene Bilderkennung. Verwende die Werte aus dem OCR-Text.

Analysiere jede Seite einzeln. Nenne den Dokumenttyp. Zeige die erkannten Daten pro Seite strukturiert an. Frage den Benutzer ob die Daten korrekt sind bevor du fortfährst.`

    const phase1 = await withRetry(() => generateText({
      model,
      maxRetries: 0,
      temperature: 0,
      system: phase1System,
      messages: buildAiMessages(messages),
      stopWhen: stepCountIs(1),
    }))
    return { text: phase1.text || 'Keine Ergebnisse.' }
  }

  if (imagesBase64?.length) {
    // Phase 1: Bilder analysieren — nur Text zurückgeben, NICHTS speichern
    pendingImages = imagesBase64
    pendingPdfOcrTexts = []

    // OCR-Vorverarbeitung für perfekte Texterkennung (Tabellen, Spalten, Beträge)
    const ocrResults = await Promise.all(
      imagesBase64.map(img => withRetry(() => callMistralOcr(img, opts.access)).catch(() => ({ markdown: '', cacheId: '' }))),
    )
    const ocrTexts = ocrResults.map(r => r.markdown)

    const ocrContext = ocrTexts.filter(Boolean).length
      ? `\n\n--- OCR-ERGEBNIS (exakter Text vom Dokument) ---\n${ocrTexts.map((t, i) => `Bild ${i + 1}:\n${t}`).join('\n\n')}\n--- ENDE OCR ---\n\nDer OCR-Text oben ist maschinengelesen und daher bei Zahlen, Tabellen und Beträgen GENAUER als deine eigene Bilderkennung. Verwende die Werte aus dem OCR-Text.`
      : ''

    const phase1System = `${SYSTEM_PROMPT}

Analysiere das Bild sorgfältig. Das Bild kann gedreht sein (90° oder 180°) — lies den Text in der richtigen Leserichtung.

SCHRITT 1 — DOKUMENTTYP ERKENNEN:
Bestimme ZUERST den Dokumenttyp anhand des Inhalts:
- **Rechnung/Quittung**: Werkstattname, Beträge, Positionen mit Preisen, MwSt.
- **Service-Heft/Wartungsplan**: Wartungsintervalle (km/Monate), Inspektionsplan, Wartungsnachweis, "Kleine/Große Wartung", Stempelfelder
- **Kaufvertrag/Fahrzeugschein**: Fahrzeugdaten, Halter, Erstzulassung
Nenne den erkannten Dokumenttyp EXPLIZIT am Anfang deiner Antwort.
WICHTIG: Ein Service-Heft enthält Wartungsintervalle und Stempel — auch wenn eine Werkstatt-Adresse (z.B. "Porsche Zentrum") darauf steht, ist es KEINE Rechnung!

SCHRITT 2 — DATEN EXTRAHIEREN:

Falls RECHNUNG:
- KENNZEICHEN vs. FAHRGESTELLNUMMER:
  - Kennzeichen (license plate): Kürzel + Zahlen, z.B. "SG 218574" (Schweizer Kanton St. Gallen), "M-AB 1234"
  - Fahrgestellnummer/VIN: Genau 17 Zeichen, beginnt mit W, V, etc. z.B. "WP1ZZZ9PZ8LA14872"
  - "SG 218574" ist ein SCHWEIZER KENNZEICHEN, NICHT eine Fahrgestellnummer!
- POSITIONEN KORREKT LESEN:
  - Lies die Tabellenspalten sorgfältig: Beschreibung | Menge | Einheit | Einzelpreis | Betrag
  - Betrag pro Position = Menge × Einzelpreis. Wenn es nicht aufgeht, hast du falsch gelesen.
  - MwSt./MWST/USt. Zeilen sind KEINE eigenen Positionen — NIEMALS als Position auflisten!
  - "Summe Arbeiten", "Summe Teile", "Nettobetrag", "Zwischensumme" sind KEINE Positionen
  - Nur tatsächliche Arbeiten und Teile sind Positionen
  - Kontrolliere: Summe aller Positions-Beträge ≈ Netto-Gesamtbetrag (vor MwSt.)
- WÄHRUNG: "CHF" → CHF, "€" oder "EUR" → EUR

Falls SERVICE-HEFT/WARTUNGSPLAN:
- Lies alle Wartungsintervalle ab (km UND Zeitintervalle)
- Zeige eine Tabelle: Wartungsart | km-Intervall | Zeit-Intervall
- Zeige auch durchgeführte Wartungen (Stempel/Einträge) falls vorhanden
- Erwähne das Fahrzeugmodell falls erkennbar (z.B. "Cayenne V6")

Falls KAUFVERTRAG/FAHRZEUGSCHEIN:
- Zeige alle Fahrzeugdaten: Marke, Modell, Baujahr, Fahrgestellnummer, Kennzeichen, Erstzulassung
${ocrContext}

Zeige die erkannten Daten strukturiert an. Frage den Benutzer ob die Daten korrekt sind bevor du fortfährst.`

    // Vision-Modell: max 8 Bilder. Bei >8 nur OCR-Text verwenden (kein Bild im Request)
    const visionImages = imagesBase64.length <= 8 ? imagesBase64 : undefined

    const phase1 = await withRetry(() => generateText({
      model,
      maxRetries: 0,
      temperature: 0,
      system: phase1System,
      messages: buildAiMessages(messages, visionImages),
      stopWhen: stepCountIs(1),
    }))
    return { text: phase1.text || 'Keine Ergebnisse.' }
  }

  // Phase 2: Wenn Bilder oder PDF-OCR aus vorheriger Nachricht zwischengespeichert sind
  const storedImages = pendingImages.length ? [...pendingImages] : undefined
  const storedPdfOcr = pendingPdfOcrTexts.length ? [...pendingPdfOcrTexts] : undefined
  if (storedImages?.length)
    pendingImages = []
  if (storedPdfOcr?.length)
    pendingPdfOcrTexts = []

  const allTools = createTools(opts.access, opts.model, storedImages)
  const { scan_document: _, ...toolsWithoutScan } = allTools
  const tools = (storedImages?.length || storedPdfOcr?.length) ? toolsWithoutScan : allTools

  // Fahrzeugliste für Kontext — IMMER injizieren, nicht nur bei Bildern
  const vehicleResult = await db.queryOnce({ vehicles: {} })
  const vehicles = vehicleResult.data.vehicles || []
  const vehicleList = vehicles.map((v: any) => {
    const scheduleInfo = v.customSchedule?.length ? '✅ Service-Heft' : '⚠️ allgemeiner Wartungsplan'
    return `- ${v.make} ${v.model} (${v.year}), ${v.mileage} km${v.licensePlate ? `, ${v.licensePlate}` : ''} [${scheduleInfo}]: ID=${v.id}`
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
      content: `Kontext: PDF mit ${storedPdfOcr.length} Seite(n) wurde analysiert. Jede Seite kann eine separate Rechnung oder ein anderes Dokument (Service-Heft, Kaufvertrag) sein. Verwende das passende Tool je nach Dokumenttyp.\n\n--- OCR-TEXT ---\n${pdfContext}\n--- ENDE ---\n\n${vehicleContext}\n\nWICHTIG: Verwende NUR die exakten Fahrzeug-IDs aus der Liste oben oder aus dem Ergebnis von add_vehicle. Erfinde KEINE IDs.`,
    })
  }
  else if (storedImages?.length) {
    aiMessages.push({
      role: 'user' as any,
      content: `Kontext: Es wurden ${storedImages.length} Bilder gesendet (Index 0–${storedImages.length - 1}). Nutze das passende Tool je nach Dokumenttyp: add_invoice für Rechnungen, set_maintenance_schedule für Service-Hefte, add_vehicle für Kaufverträge/Fahrzeugscheine. Bei Rechnungen: nutze imageIndex um das Bild zu speichern.\n\n${vehicleContext}\n\nWICHTIG: Verwende NUR die exakten Fahrzeug-IDs aus der Liste oben oder aus dem Ergebnis von add_vehicle. Erfinde KEINE IDs.`,
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

  let result = await withRetry(() => generateText({
    model,
    maxRetries: 0,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: aiMessages,
    tools,
    stopWhen: stepCountIs(maxSteps),
  }))

  // Guard: Das Modell behauptet eine Aktion ("wurde eingetragen"), hat aber kein Tool aufgerufen.
  // Dann einmal mit Tool-Zwang nachfassen, statt eine Falschaussage anzuzeigen.
  if (claimsActionWithoutTool(result)) {
    console.warn('[chat] Aktion behauptet ohne Tool-Aufruf — erneuter Versuch mit toolChoice=required')
    result = await withRetry(() => generateText({
      model,
      maxRetries: 0,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [
        ...aiMessages,
        { role: 'user' as const, content: '[System] Du hast eine Aktion beschrieben, aber kein Tool aufgerufen. Führe die Aktion JETZT mit dem passenden Tool aus.' },
      ],
      tools,
      toolChoice: 'required',
      stopWhen: stepCountIs(maxSteps),
    }))
  }

  const extracted = extractResult(result)
  return {
    text: extracted.text || 'Erledigt.',
    toolResults: extracted.toolResults,
  }
}

const ACTION_CLAIM = /\b(?:wurde|wurden|habe ich|ist|sind)\b[^.]{1,80}\b(?:angelegt|eingetragen|gespeichert|erfasst|gelöscht|aktualisiert|erstellt|hinzugefügt)\b|\*\*(?:Wartung eingetragen|Fahrzeug angelegt|Rechnung erfasst|Löschung|Änderung)\*\*/i

function claimsActionWithoutTool(result: { text: string, steps?: Array<{ toolCalls?: unknown[] }> }): boolean {
  const anyToolCall = (result.steps ?? []).some(s => (s.toolCalls?.length ?? 0) > 0)
  return !anyToolCall && ACTION_CLAIM.test(result.text || '')
}
