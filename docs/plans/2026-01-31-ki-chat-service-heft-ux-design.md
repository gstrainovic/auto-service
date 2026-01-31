# KI-Chat, Service-Heft & UX-Verbesserungen

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** KI-Chat mit Tool-Calling, Service-Heft-Scan, Fahrzeug-Scan via Kaufvertrag/Fahrzeugschein, Chat-Anhänge (Fotos/PDFs), und diverse UX-Verbesserungen.

**Architecture:** Floating Chat-Button (FAB) mit Drawer, Vercel AI SDK `useChat` + Tools die direkt in RxDB schreiben. Vision-Requests nutzen das bestehende Multi-Provider-System (Ollama/Gemini/OpenAI/Anthropic). Chat akzeptiert Bild- und PDF-Anhänge die als Vision-Input an das Model gehen.

**Tech Stack:** Vue 3, Quasar, RxDB, Vercel AI SDK (`ai` + `@ai-sdk/openai`), Zod, Ollama (lokal: Qwen3 für Chat/Tools, minicpm-v für Vision), Gemini Flash (online fallback)

**Getestete Modelle:**
- Qwen3 (lokal): Tool-calling ✅, Chat ✅, ~1.5 min/Request auf CPU
- minicpm-v (lokal): Vision/OCR ✅, ~30s/Request auf CPU
- Gemini 2.0 Flash (online): Alles ✅, schnell, Free Tier mit Quota-Limits

---

## Task 1: Chat-Service mit Tool-Calling Backend

**Files:**
- Create: `src/services/chat.ts`
- Modify: `src/services/ai.ts` (getModel exportieren, Chat-Model-Getter)

**Beschreibung:**
Chat-Service der Tool-Calling über Vercel AI SDK handhabt. Tools arbeiten direkt mit RxDB Collections.

**Tools-Liste:**
1. `list_vehicles` - Alle Fahrzeuge auflisten
2. `add_vehicle` - Neues Fahrzeug anlegen (make, model, year, mileage, plate)
3. `get_vehicle` - Fahrzeug-Details mit Rechnungen und Wartungshistorie
4. `add_invoice` - Rechnung manuell eintragen
5. `get_maintenance_status` - Wartungsstatus eines Fahrzeugs prüfen
6. `scan_document` - Foto/PDF analysieren (Rechnung, Kaufvertrag, Fahrzeugschein, Service-Heft)
7. `update_vehicle` - Fahrzeug-Daten aktualisieren (km-Stand, etc.)
8. `delete_vehicle` - Fahrzeug löschen
9. `delete_invoice` - Rechnung löschen

**Step 1:** `getModel` in `ai.ts` exportieren und Chat-spezifischen Model-Getter ergänzen (Qwen3 für Chat, minicpm-v für Vision).

**Step 2:** `chat.ts` erstellen mit:
```typescript
import { tool } from 'ai'
import { z } from 'zod'

export function createChatTools(db: RxDatabase) {
  return {
    list_vehicles: tool({
      description: 'Listet alle Fahrzeuge auf',
      parameters: z.object({}),
      execute: async () => {
        const vehicles = await db.vehicles.find().exec()
        return vehicles.map(v => v.toJSON())
      },
    }),
    add_vehicle: tool({
      description: 'Fügt ein neues Fahrzeug hinzu',
      parameters: z.object({
        make: z.string().describe('Marke'),
        model: z.string().describe('Modell'),
        year: z.number().describe('Baujahr'),
        mileage: z.number().optional().describe('Kilometerstand'),
        plate: z.string().optional().describe('Kennzeichen'),
      }),
      execute: async (args) => {
        const doc = await db.vehicles.insert({
          id: crypto.randomUUID(),
          ...args,
          invoices: [],
          customSchedule: [],
        })
        return doc.toJSON()
      },
    }),
    // ... weitere Tools analog
    scan_document: tool({
      description: 'Analysiert ein Foto oder PDF. Erkennt automatisch ob es eine Rechnung, ein Kaufvertrag, ein Fahrzeugschein oder eine Service-Heft-Seite ist.',
      parameters: z.object({
        imageBase64: z.string().describe('Base64-kodiertes Bild'),
        vehicleId: z.string().optional().describe('Fahrzeug-ID falls bekannt'),
      }),
      execute: async (args) => {
        // Verwendet Vision-Model (minicpm-v/Gemini) zur Dokumenttyp-Erkennung + Extraktion
      },
    }),
  }
}
```

**Step 3:** System-Prompt definieren:
```
Du bist der Auto-Service Assistent. Du hilfst beim Verwalten von Fahrzeugen und Wartungen.
Deine Fähigkeiten:
- Fahrzeuge anlegen, bearbeiten, löschen
- Rechnungen und Wartungen eintragen
- Fotos von Rechnungen, Kaufverträgen, Fahrzeugscheinen und Service-Heften analysieren
- Wartungsstatus prüfen und Empfehlungen geben
- Fragen zu Wartungsintervallen beantworten

Antworte immer auf Deutsch. Wenn du ein Tool benutzt, erkläre kurz was du tust.
```

**Step 4:** Tests schreiben und laufen lassen.

**Step 5:** Commit.

---

## Task 2: Chat-UI Komponente (Floating Button + Drawer)

**Files:**
- Create: `src/components/ChatDrawer.vue`
- Modify: `src/layouts/MainLayout.vue` (FAB + Drawer einbinden)

**Beschreibung:**
Floating Action Button (FAB) unten rechts, öffnet einen Quasar Drawer mit Chat-Interface.

**UI-Elemente:**
- FAB: `q-btn fab` mit Chat-Icon, Position fixed bottom-right
- Drawer: `q-drawer` side="right" mit:
  - Header: "KI-Assistent" + Close-Button
  - Message-Liste: `q-chat-message` Komponenten
  - Anhang-Button: Kamera/Datei-Upload (Fotos + PDFs)
  - Input: `q-input` mit Send-Button
  - Welcome-Message beim Start mit Tool-Liste

**Step 1:** `ChatDrawer.vue` erstellen:
```vue
<template>
  <q-btn fab icon="chat" class="chat-fab" @click="open = true" />
  <q-drawer v-model="open" side="right" :width="380" overlay>
    <div class="column full-height">
      <q-toolbar class="bg-primary text-white">
        <q-toolbar-title>KI-Assistent</q-toolbar-title>
        <q-btn flat icon="close" @click="open = false" />
      </q-toolbar>

      <q-scroll-area class="col">
        <div class="q-pa-md">
          <!-- Welcome message on empty chat -->
          <q-chat-message v-if="messages.length === 0" name="Assistent" sent>
            <div>
              Hallo! Ich bin dein Auto-Service Assistent. Ich kann:
              <ul>
                <li>Fahrzeuge anlegen und verwalten</li>
                <li>Rechnungen und Service-Hefte scannen</li>
                <li>Kaufverträge und Fahrzeugscheine auslesen</li>
                <li>Wartungsstatus prüfen</li>
                <li>Fragen zu deinem Auto beantworten</li>
              </ul>
              Schick mir einfach eine Nachricht oder ein Foto!
            </div>
          </q-chat-message>

          <q-chat-message
            v-for="msg in messages" :key="msg.id"
            :name="msg.role === 'user' ? 'Du' : 'Assistent'"
            :sent="msg.role === 'assistant'"
          >
            <!-- Anhang-Vorschau für Bilder -->
            <img v-if="msg.attachment?.type === 'image'" :src="msg.attachment.url" class="chat-attachment" />
            <div v-html="renderMarkdown(msg.content)" />
          </q-chat-message>
        </div>
      </q-scroll-area>

      <!-- Anhang-Vorschau -->
      <div v-if="pendingAttachment" class="q-px-md">
        <q-chip removable @remove="pendingAttachment = null">
          <q-avatar v-if="pendingAttachment.type === 'image'">
            <img :src="pendingAttachment.preview" />
          </q-avatar>
          {{ pendingAttachment.name }}
        </q-chip>
      </div>

      <div class="q-pa-sm row items-end gap-sm">
        <q-btn flat round icon="attach_file" @click="pickFile">
          <q-tooltip>Foto oder PDF anhängen</q-tooltip>
        </q-btn>
        <q-input v-model="input" class="col" outlined dense placeholder="Nachricht..." @keyup.enter="send" />
        <q-btn round color="primary" icon="send" :loading="isLoading" @click="send" />
      </div>
    </div>
  </q-drawer>
</template>
```

**Step 2:** Anhang-Logik: File-Input akzeptiert `image/*,application/pdf`. Bilder werden zu Base64 konvertiert, PDFs werden als Base64 an Vision-Model gesendet.

**Step 3:** In `MainLayout.vue` einbinden.

**Step 4:** Tests, Commit.

---

## Task 3: Dokument-Scanner (Rechnung, Kaufvertrag, Fahrzeugschein, Service-Heft)

**Files:**
- Modify: `src/services/ai.ts` (neue Schemas + Parse-Funktionen)
- Modify: `src/pages/ScanPage.vue` (Tab-Switch: Rechnung / Service-Heft / Dokument)

**Beschreibung:**
Erweitert den bestehenden Scanner um weitere Dokumenttypen. AI erkennt automatisch den Typ.

**Neue Schemas:**

```typescript
// Kaufvertrag / Fahrzeugschein → Fahrzeug-Daten
const vehicleDocumentSchema = z.object({
  documentType: z.string().describe('Art des Dokuments: kaufvertrag, fahrzeugschein, sonstiges'),
  make: z.string().describe('Marke'),
  model: z.string().describe('Modell'),
  year: z.number().describe('Baujahr / Erstzulassung'),
  vin: z.string().optional().describe('Fahrgestellnummer (VIN)'),
  plate: z.string().optional().describe('Kennzeichen'),
  mileage: z.number().optional().describe('Kilometerstand'),
  engineType: z.string().optional().describe('Motortyp (Diesel, Benzin, Elektro, Hybrid)'),
  enginePower: z.string().optional().describe('Leistung (z.B. 140 kW / 190 PS)'),
  purchaseDate: z.string().optional().describe('Kaufdatum YYYY-MM-DD'),
  purchasePrice: z.number().optional().describe('Kaufpreis in Euro'),
})

// Service-Heft → Wartungshistorie + Hersteller-Intervalle
const serviceBookSchema = z.object({
  entries: z.array(z.object({
    date: z.string().describe('Datum YYYY-MM-DD'),
    mileage: z.number().describe('Kilometerstand'),
    workshopName: z.string().optional().describe('Werkstatt'),
    items: z.array(z.object({
      description: z.string(),
      category: z.string().describe('oelwechsel, bremsen, reifen, inspektion, luftfilter, zahnriemen, bremsflüssigkeit, klimaanlage, tuev, karosserie, elektrik, sonstiges'),
    })),
  })),
  manufacturerIntervals: z.array(z.object({
    type: z.string().describe('Wartungstyp'),
    intervalKm: z.number().describe('Intervall in km (0 wenn nur zeitbasiert)'),
    intervalMonths: z.number().describe('Intervall in Monaten'),
  })).optional().describe('Hersteller-Intervalle falls auf der Seite sichtbar'),
})
```

**Step 1:** Schemas und Parse-Funktionen in `ai.ts` ergänzen: `parseVehicleDocument()`, `parseServiceBook()`.

**Step 2:** `ScanPage.vue` erweitern: Tab-Leiste oben (Rechnung | Service-Heft | Fahrzeug-Dokument). Je nach Tab andere Schema-Funktion aufrufen, andere Ergebnis-Anzeige.

**Step 3:** Bei Fahrzeug-Dokument: Ergebnis zeigt extrahierte Daten, Button "Fahrzeug anlegen" erstellt direkt ein neues Fahrzeug in RxDB.

**Step 4:** Bei Service-Heft: Ergebnis zeigt erkannte Einträge, Button "Zu Fahrzeug hinzufügen" speichert alle Einträge als Wartungshistorie. Falls Hersteller-Intervalle erkannt, `customSchedule` am Fahrzeug aktualisieren.

**Step 5:** Tests, Commit.

---

## Task 4: Fahrzeug-spezifische Wartungsintervalle (customSchedule)

**Files:**
- Modify: `src/services/maintenance-schedule.ts`
- Modify: RxDB Schema (Vehicle-Collection)

**Beschreibung:**
Fahrzeuge bekommen ein optionales `customSchedule`-Feld. Wenn gesetzt, überschreibt es die Brand-Defaults.

**Step 1:** Vehicle-Schema erweitern:
```typescript
customSchedule: {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      type: { type: 'string' },
      label: { type: 'string' },
      intervalKm: { type: 'number' },
      intervalMonths: { type: 'number' },
    },
  },
}
```

**Step 2:** `getMaintenanceSchedule` anpassen:
```typescript
export function getMaintenanceSchedule(make: string, _model: string, customSchedule?: ScheduleItem[]): ScheduleItem[] {
  if (customSchedule?.length) return customSchedule
  return BRAND_SCHEDULES[make] || DEFAULT_SCHEDULE
}
```

**Step 3:** Dashboard und ScanPage nutzen `customSchedule` wenn vorhanden.

**Step 4:** Tests, Commit.

---

## Task 5: Foto-Anzeige bei Rechnungen

**Files:**
- Modify: RxDB Schema (Invoice: `imageBase64` Feld)
- Modify: `src/pages/ScanPage.vue` (Base64 mit speichern)
- Modify: Vehicle-Detail-Ansicht (Foto anzeigen)

**Beschreibung:**
Beim Scannen einer Rechnung wird das Original-Foto als Base64 in RxDB gespeichert und in der Rechnungs-Detail-Ansicht angezeigt.

**Step 1:** Invoice-Schema um `imageBase64: string` erweitern.

**Step 2:** In `ScanPage.vue` beim Speichern das Base64-Bild mit in die Invoice schreiben.

**Step 3:** In der Fahrzeug-Detail-Seite (Rechnungen-Tab): Klick auf Rechnung zeigt Dialog mit Original-Foto + extrahierten Daten.

**Step 4:** Tests, Commit.

---

## Task 6: Löschen und Bearbeiten von Einträgen

**Files:**
- Modify: `src/pages/DashboardPage.vue` (Delete-Buttons)
- Modify: Vehicle-Detail-Ansicht (Delete/Edit für Rechnungen)

**Beschreibung:**
- Dashboard: Swipe-to-delete oder Long-Press auf Wartungseintrag → Confirm-Dialog → Löschen
- Rechnungen: Delete-Button in Rechnungs-Detail → Confirm → Aus RxDB entfernen
- Fahrzeuge: Delete-Button in Fahrzeug-Detail → Confirm → Aus RxDB entfernen (mit allen Rechnungen)

**Step 1:** Dashboard-Einträge: `q-slide-item` mit Delete-Action oder `q-btn` mit Mülleimer-Icon.

**Step 2:** Rechnungs-Detail: Delete-Button, `q-dialog` zur Bestätigung.

**Step 3:** Fahrzeug-Detail: Delete-Button mit Warnung "Alle Rechnungen werden ebenfalls gelöscht".

**Step 4:** Tests, Commit.

---

## Task 7: Weitere Test-Fixtures und E2E-Tests

**Files:**
- Create: `e2e/fixtures/test-kaufvertrag.png`
- Create: `e2e/fixtures/test-fahrzeugschein.png`
- Create: `e2e/fixtures/test-service-heft.png`
- Modify: `e2e/invoice-scan-flow.spec.ts` (erweitern)
- Create: `e2e/chat-flow.spec.ts`
- Create: `e2e/vehicle-document-scan.spec.ts`

**Beschreibung:**
Erstelle realistische Test-Fixtures (generierte Bilder mit deutschem Text) und E2E-Tests für:
1. Chat: Fahrzeug per Chat anlegen, Wartungsstatus abfragen
2. Kaufvertrag-Scan: Foto → Fahrzeug erstellen
3. Service-Heft-Scan: Foto → Wartungshistorie importieren
4. Löschen: Rechnung löschen, Fahrzeug löschen

**Step 1:** Test-Fixtures mit Canvas/Sharp generieren (deutsche Rechnungen, Kaufverträge, etc.)

**Step 2:** E2E-Tests schreiben mit Ollama/Qwen3 für Chat, minicpm-v für Vision.

**Step 3:** Alle Tests laufen lassen, fixen, committen.

---

## Verifikation

```bash
npx eslint .                    # 0 Fehler
npm run build                   # Erfolgreich
npx playwright test             # Alle Tests grün
```

## Provider-Strategie

| Use Case | Lokal (Ollama) | Online (Fallback) |
|----------|---------------|-------------------|
| Chat + Tool-Calling | Qwen3 | Gemini 2.0 Flash |
| Vision/OCR (Rechnungen, Docs) | minicpm-v | Gemini 2.0 Flash |
| Service-Heft (multi-entry) | minicpm-v | Gemini 2.0 Flash |
