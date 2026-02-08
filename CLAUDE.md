# TODO:
*.png aufräumen?
podman-compose fehlt instantdb

# Auto-Service PWA

## Commands
npm run dev          # Vite dev server + auto-starts InstantDB if not running
npm run dev:vite     # Vite dev server only (no InstantDB check)
npm run build        # vue-tsc + vite build
npm run lint         # ESLint (antfu config)
npm run lint:fix     # ESLint autofix
npm run test:e2e     # Playwright E2E (loads .env via dotenv)
npm run test:e2e:ui  # Playwright UI mode
npx tsx scripts/compare-ai.ts  # Compare AI providers on test invoice

## Architecture
Vue 3 + Quasar + Pinia + **InstantDB** (self-hosted) + Vercel AI SDK v6 + PWA

src/
  pages/          # DashboardPage, VehiclesPage, VehicleDetailPage, SettingsPage
  components/     # ChatDrawer, VehicleCard, VehicleForm
  services/       # ai.ts (multi-provider), chat.ts (tool-calling), maintenance-schedule.ts
  stores/         # Pinia: vehicles, invoices, maintenances, settings
  lib/            # instantdb.ts (DB-Client)
  composables/    # useImageResize (client-side 1540px resize), useImageUpload, useFormValidation
e2e/              # Playwright tests + fixtures/
scripts/          # compare-ai.ts

## InstantDB (Self-Hosted)
Backend-Datenbank mit Echtzeit-Sync via WebSocket. Ersetzt RxDB.

### Server starten
```bash
cd ~/instant/server && podman-compose -f docker-compose-dev.yml up -d
```

### Server stoppen
```bash
cd ~/instant/server && podman-compose -f docker-compose-dev.yml down
```

### PostgreSQL-Zugriff (Debug)
```bash
podman exec server_postgres_1 psql -U instant -d instant -c "SELECT * FROM apps;"
```

### Konfiguration
- App-ID: `cd7e6912-773b-4ee1-be18-4d95c3b20e9f`
- HTTP API: Via Vite-Proxy `/instant-api → localhost:8888`
- WebSocket: `ws://localhost:8888/runtime/session`
- DevTools deaktiviert (Toggle-Button blockierte UI-Klicks)

### InstantDB vs RxDB Unterschiede
- **Entity-IDs müssen UUIDs sein** — keine beliebigen Strings (z.B. SHA-256 Hashes)
- **Schemaless** — keine Schema-Definition nötig, Felder werden dynamisch erstellt
- **Echtzeit-Sync** — Änderungen werden sofort an alle Clients gepusht
- **Offline-First** — Daten in IndexedDB, Lesen+Schreiben funktionieren offline, Sync via CRDT bei Reconnect

## AI Providers
Vier cloud Providers via Vercel AI SDK v6:
- **mistral** (mistral-small-latest) — primary, vision+chat+tools, schnell (~3s), zuverlässiges Tool-Calling
- **anthropic** (claude-sonnet-4-20250514)
- **openai** (gpt-4o-mini)
- **meta-llama** (meta-llama/llama-4-maverick via OpenRouter) — vision+chat+tools

Entfernte Provider: OpenRouter+Gemini (SDK-Inkompatibilitäten mit neuen Gemini-Response-Feldern wie `reasoning`, `file_search_call`; Gemini narrated Tool-Calls statt sie auszuführen), Google direct (Quota-Limits), Groq (Vision eingestellt).

Provider + API key in localStorage (Settings page). .env nur für E2E-Tests.

## Privacy / Datenschutz der Provider
WICHTIG: Bei kostenlosen API-Tiers bezahlt man mit seinen Daten.
- **OpenRouter + Gemini Free**: Google trainiert mit Free-Tier-Daten. In EU nicht erlaubt ohne Paid Tier.
- **Mistral Experiment (Free)**: Daten werden standardmäßig für Training verwendet. Opt-out möglich. Scale-Plan für Produktion nötig.
- **Meta Llama API**: Kein Training mit API-Daten, ABER multimodale Modelle in EU eingeschränkt.
- **Anthropic API**: Kein Training mit API-Daten. 7 Tage Retention. Nicht kostenlos.
- **OpenAI API**: Kein Training seit März 2023. Nicht kostenlos.
- **Ollama (lokal)**: 100% privat — keine Daten verlassen den Rechner. Braucht GPU für akzeptable Geschwindigkeit.

## Ollama (lokaler Provider)
Getestetes Setup (Jan 2026): Ollama 0.15.2, qwen3-vl:2b, Quadro P1000 (4 GB VRAM), CUDA 13.0.
- Vision (Rechnungsscan): ~13s — korrekt (Werkstatt, Datum, Betrag)
- Tool Calling: ~7s — korrekt (list_vehicles)
- GPU wird im "low VRAM mode" genutzt (unter 20 GiB = Mischung GPU+CPU)
- qwen3-vl:4b (3.3 GB) hängt bei Vision auf 4 GB VRAM — 2b empfohlen
- Ollama API: http://localhost:11434, OpenAI-kompatibel via /v1/chat/completions

## Mistral Vision Limits (Chat-Modell: mistral-small-latest)
Quelle: docs.mistral.ai/capabilities/vision
- Max **8 Bilder** pro API-Request
- Max **10 MB** pro Bild, max **10.000×10.000 px**
- Formate: JPEG, PNG, WEBP, GIF (single-frame)
- Mistral Small: intern auf **1540×1540** skaliert → client-seitig auf 1540px resizen spart Bandbreite
- Tokens pro Bild: `(W × H) / 784` ≈ max 3.025 bei 1540×1540
- Client-Resize: `useImageResize.ts` → JPEG 80%, max 1540px longest side

## Mistral OCR Limits (OCR-Modell: mistral-ocr-latest)
Quelle: docs.mistral.ai/capabilities/OCR/basic_ocr/
- Max **50 MB** Dateigröße, max **1.000 Seiten** pro Request
- **Bilder**: PNG, JPEG/JPG, AVIF (per URL oder Base64)
- **Dokumente**: PDF, PPTX, DOCX (per URL, Base64 oder Cloud-Upload)
- Verarbeitung bei **200 DPI** (intern)
- Page-Selection möglich: einzelne Seite, Range, oder Liste (0-basiert)
- Tabellen: `table_format` = `null` | `markdown` | `html`
- Header/Footer-Extraktion optional (`extract_header`, `extract_footer`)
- **Kein** Character-Formatting (bold, italic, underline) — aber Fußnoten (Superscript)
- Pricing: ~$0.001 pro Seite ($1/1.000 Seiten)
- Rate-Limit: 2.000 Seiten/Minute (Scale-Tier)
- Azure/Foundry: max 30 MB, max 30 Seiten
- Zwei-Stufen-Pipeline (OCR → Chat) ist zuverlässiger als Document Annotation (Ein-Stufe halluziniert)

## Mistral API Tiers & Rate-Limits
- **Experiment (Free)**: 50K Tokens/Min, 4M Tokens/Monat, 1 RPS — verstecktes Vision-Rate-Limit
- **Scale (Paid)**: 2M Tokens/Min, 360 Req/Min — kein separates Vision-Limit
- Dashboard zeigt Scale-Limits auch im Experiment-Plan an (irreführend!)
- Spending-Limit ≠ Tier-Upgrade — man muss explizit auf Scale wechseln
- `maxRetries: 0` auf allen AI SDK Calls — verhindert SDK-interne Retries (default: 2) die Rate-Limit aufbrauchen

## Key Patterns
- AI SDK v6: `inputSchema` (not `parameters`), `stopWhen: stepCountIs(n)` (not maxSteps)
- Chat tools write directly to InstantDB — no REST API layer
- Chat stepCount=5 (Phase 2), dynamisch höher für PDF mit vielen Seiten
- Chat-Verlauf wird in InstantDB `chatmessages` Entity persistiert
- >8 Bilder: OCR-Text wird verwendet, Bilder nicht an Vision-Modell gesendet
- Regelbasierte Kategorie-Korrektur: Keywords überschreiben AI-Zuordnung (z.B. "Auspuff" → auspuff)
- PDF-Upload: max 50 MB, OCR pro Seite, Duplikat-Erkennung bei identischen Seiten
- `scan_document` Tool wird ausgeblendet wenn Bilder im Message sind (Modell sieht Bilder direkt)
- `add_maintenance` Tool: Wartung OHNE Rechnung eintragen (z.B. manuell berichtete Arbeiten)
- Chat: Kamera-Button (capture="environment"), Drag & Drop, Multi-PDF-Upload, Maximize mit 30/70 Split
- Chat Tool Results: `sendChatMessage` gibt `{ text, toolResults? }` zurück, ToolResultCard als PrimeVue Panel
- AI SDK v6: Tool-Ergebnisse in `tr.output` (nicht `tr.result`), `tr.toolName` für Tool-Name
- z.enum(MAINTENANCE_CATEGORIES) enforces valid categories in AI schemas
- InstantDB: Entity-IDs müssen UUIDs sein (nutze `id()` Funktion)

## E2E Testing

### Architektur
- **`beforeEach` + `clearInstantDB`**: Jeder Test startet mit leerer Datenbank
- Tests folgen **CRUD-Paradigma**: Create → Read → Update → Delete
- Tests laufen automatisch **zweimal**: online + offline (via Network-Blocking)
- **Playwright startet Server automatisch** (Vite + InstantDB) — kein manuelles `podman-compose up` nötig
- `npm run test:e2e` führt beide Projekt-Varianten aus (104 Tests: 52 online + 52 offline)

### Offline-Testing
Die `simulateOffline` Fixture blockiert alle Requests zu `localhost:8888` (InstantDB-Server).
Dies testet die Offline-First-Fähigkeit: Daten werden in IndexedDB gespeichert und die App funktioniert ohne Server.

### Test-IDs (Präfix-Schema)
| Präfix | Bereich | Beispiel |
|--------|---------|----------|
| VF | Vehicle Flow | VF-001: add a vehicle |
| DF | Delete Flow | DF-001: delete with dialog |
| SR | Scan Redirect | SR-001: redirect to chat, SR-002: navigation |
| VD | Vehicle Document | VD-001: Kaufvertrag |
| CR | CRUD Operations | CR-001 bis CR-009 |
| RF | Rotation Flow | RF-001: auto-rotate |
| CF | Chat Flow | CF-001 bis CF-006 |
| CU | Chat Upload | CU-001 bis CU-011 |
| CM | Chat Maintenance | CM-001: add without invoice |
| SC | Schedule Flow | SC-001: chat tool |
| SH | Schedule Hint | SH-001, SH-002 |
| SE | Settings Flow | SE-001 bis SE-004 |
| CI | Chat Image | CI-001: rotation |
| CS | Chat Schedule | CS-001, CS-002 |
| TC | Tool Cards | TC-001, TC-002 |
| ES | Empty States | ES-001 bis ES-003 |
| SL | Split Layout | SL-001: 30/70 split maximized |
| MV | MediaViewer | MV-002: chat image OCR tab |
| DP | Dashboard Progress | DP-001: progress indicator |
| DS | Design System | DS-001, DS-002 |
| UP | UI Primitives | UP-001, UP-002 |
| IF | Invoice Form | IF-001: validation, IF-002: submit |
| MF | Maintenance Form | MF-001: validation, MF-002: submit |
| DB | Dashboard Stats | DB-001: total cost, DB-002: invoice count |
| IU | Image Upload | IU-001: preview, IU-002: submit with image |

**Gesamt: 64 Tests pro Projekt** — `npm run test:e2e --list` zeigt alle

### Test-Konventionen
- Tests importieren von `./fixtures/test-fixtures` statt `@playwright/test`
- PrimeVue icon-only buttons need CSS class selectors (.chat-fab), not getByRole
- .env loaded by playwright.config.ts, keys injected via page.evaluate → localStorage
- Alle AI-Tests nutzen Mistral als Default (schnell, zuverlässig, ~3–6s für Vision+Tools)
- Use .first() for assertions that may match multiple elements (AI can create duplicates)
- Chat-Test: Assertion auf Tool-Ergebnis muss `erledigt` einschließen (Fallback wenn Model keinen eigenen Text generiert)
- Console-Error-Detection: Alle Tests failen automatisch bei unerwarteten console.error/pageerror (IGNORED_ERRORS in test-fixtures.ts)
- Offline-Tests: Alle Console-Errors werden ignoriert (InstantDB WebSocket expected)
- **SPA-Navigation testen:** `page.goto()` macht Full-Page-Load (triggert `onMounted`). Für echte SPA-Navigation: User-Interaktionen (Klicks) statt goto verwenden. Vue `onMounted` läuft nur einmal → `watch(() => route.query)` für Query-Parameter-Reaktivität

### PrimeVue Selektor-Gotchas
- `getByRole('button', { name: 'X' })` matcht Text-Buttons UND Icon-only-Buttons (beide haben aria-label)
- Für Header-Buttons mit sichtbarem Text: `button:has-text("Löschen")` statt `getByRole`
- Dialog Close-Button: `getByRole('button', { name: 'Close' })` (nicht `.pi-times` CSS-Klasse)
- VehicleDetailPage hat mehrere "Löschen"-Buttons (Header + Item-Buttons) — `.first()` oder spezifischen Container verwenden

## Code Style
- German UI text and AI schema descriptions
- antfu ESLint (no semicolons, single quotes, if-newline rule)
- All source TypeScript; eslint.config.js stays .js (ESLint compat)

## InstantDB Gotchas
- Entity-IDs müssen UUIDs sein — `id()` verwenden, Hashes als separates Feld speichern
- `devtool: false` setzen — DevTools-Toggle blockiert UI-Klicks in Tests
- OCR-Cache: `tx.ocrcache[id()].update({ hash, markdown, ... })` statt `tx.ocrcache[hash].update(...)`

## Gotchas
- Lint errors in docs/plans/*.md are false positives (code blocks parsed as JS)
- Mistral ist der primäre E2E-Test-Provider — andere Provider können abweichendes Tool-Calling-Verhalten zeigen
- Fedora: `podman-compose` statt `docker-compose` verwenden
