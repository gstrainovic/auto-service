# Auto-Service PWA

## Commands
npm run dev          # Vite dev server + auto-starts InstantDB if not running
npm run dev:vite     # Vite dev server only (no InstantDB check)
npm run build        # vue-tsc + vite build
npm run lint         # ESLint (antfu config)
npm run lint:fix     # ESLint autofix
npm run test:e2e     # Playwright E2E (loads .env via dotenv)
npm run test:e2e:ui  # Playwright UI mode
npm run test:e2e:soft # Weiche KI-Tests (@soft), nicht Teil der Standard-Suite
npm run test:unit    # Vitest: src/**/*.test.ts (die AI-Proxy-Tests liegen im Repo ~/projects/ai-proxy)
npm run dev:proxy    # AI-Proxy lokal aus node_modules/@strainovic/ai-proxy (liest .env, Port 8787)

## Architecture
Vue 3 + PrimeVue + Pinia + **InstantDB** (self-hosted) + Vercel AI SDK v6 + PWA + **AI-Proxy** (eigenes Repo `~/projects/ai-proxy`, Paket `@strainovic/ai-proxy` via `file:../ai-proxy`)

src/
  pages/          # LandingPage, LoginPage, DashboardPage, VehiclesPage, VehicleDetailPage, SettingsPage, ImpressumPage, DatenschutzPage
  components/     # ChatDrawer, MediaViewer, ToolResultCard, StatCard, VehicleCard, VehicleForm, Invoice*/Maintenance* (Form + FormDialog)
  services/       # ai.ts (Mistral: OCR-Pipeline + Modell-Factory), chat.ts (tool-calling), maintenance-schedule.ts
  stores/         # Pinia: vehicles, invoices, maintenances, settings
  lib/            # instantdb.ts (DB-Client), instant-config.ts (Modus cloud/local/selfhosted, reine Funktion)
../ai-proxy/      # AI-Proxy (eigenes Repo): app.ts (Hono, DI), auth/instant.ts, billing.ts (Stripe), limits.ts,
                  # plans.ts (Frontend importiert '@strainovic/ai-proxy/plans'), stores/ (memory, instant), Dockerfile
deploy/           # docker-compose.yml (ai-proxy + caddy für PWA), Caddyfile, .env.example
  composables/    # useImageResize (client-side 1540px resize), useImageUpload, useFormValidation
e2e/              # Playwright tests + fixtures/
scripts/          # dev.sh (Vite + InstantDB), test-9-images.ts (manueller OCR-Pipeline-Test)
tmp/              # Testbilder + 9-Seiten-PDF für manuelle Tests (gitignored, NICHT löschen)

## InstantDB
Backend-Datenbank mit Echtzeit-Sync via WebSocket. Ersetzt RxDB.

### Modi (`src/lib/instant-config.ts`)
- **Cloud (Default, Auslaufmodell):** instantdb.com — App-ID `5d413a89-91ad-4a5a-ad71-d2df5fd81d88`.
  Instant-Team ging 2026 zu OpenAI, keine neuen Signups, **Cloud-Abschaltung 31.08.2027**.
- **Local:** `VITE_INSTANTDB_MODE=local` — App-ID `cd7e6912-773b-4ee1-be18-4d95c3b20e9f`, Auth-Bypass (E2E)
- **Selfhosted (Produktion):** `VITE_INSTANTDB_MODE=selfhosted` + `VITE_INSTANT_APP_ID`, `VITE_INSTANT_API_URI`,
  optional `VITE_INSTANT_WS_URI` (sonst aus API-URI abgeleitet). Echte Auth, kein Bypass.
- E2E-Tests laufen IMMER gegen lokalen Server (Playwright setzt `VITE_INSTANTDB_MODE=local`)
- `npm run dev` → Cloud, `npm run dev:vite` in Tests → Local

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
- Server-Config: `~/instant/server/resources/config/override.edn`
- DevTools deaktiviert (Toggle-Button blockierte UI-Klicks)

### Produktion (Hetzner)
- Anleitung: `README.md` → "Produktion auf Hetzner". InstantDB nach offiziellem VPS-Guide
  (instantdb.com/docs/self-hosting/vps), PWA + AI-Proxy über `deploy/docker-compose.yml`.
- Frontend-URIs kommen aus `VITE_INSTANT_*` (Modus selfhosted), nicht mehr aus dem Quellcode
- Backup: `pg_dump -U instant instant`
- Admin-SDK `@instantdb/admin` ist auf **0.22.121** gepinnt (gleiche Version wie `@instantdb/core` und der
  lokale Server-Checkout vom Feb 2026). npm-latest ist 1.x → nur zusammen mit Server + Core upgraden.

### InstantDB vs RxDB Unterschiede
- **Entity-IDs müssen UUIDs sein** — keine beliebigen Strings (z.B. SHA-256 Hashes)
- **Schemaless** — keine Schema-Definition nötig, Felder werden dynamisch erstellt
- **Echtzeit-Sync** — Änderungen werden sofort an alle Clients gepusht
- **Offline-First** — Daten in IndexedDB, Lesen+Schreiben funktionieren offline, Sync via CRDT bei Reconnect

### Auth (Magic Codes via Postmark)
- **Postmark-Token** gehört in `~/instant/server/resources/config/override.edn` (NICHT in auto-service/.env!)
- Format: `:postmark-token {:plain "dein-token"}` in der override.edn
- Self-hosted InstantDB nutzt Postmark API, kein direktes SMTP
- Free Tier: 100 Mails/Monat (reicht für Entwicklung + Solo-Nutzung)
- Magic Code: 6-stellig, 24h TTL, Einmal-Verwendung
- Frontend-SDK: `db.auth.sendMagicCode()`, `db.auth.signInWithMagicCode()`, `db.useAuth()`
- Erweiterbar: Google/Apple/GitHub OAuth eingebaut, Passkeys via Custom Auth

## AI Provider: nur Mistral
Seit 2026-09-05 ist Mistral der einzige Provider (Vercel AI SDK v6, `@ai-sdk/mistral`).
- Chat/Vision-Modell: `mistral-small-latest` (`DEFAULT_MODEL` in `ai.ts`, in Settings überschreibbar)
- OCR: `mistral-ocr-latest` per direktem Fetch auf `/v1/ocr`
- Alle Dokument-Parser laufen über die Zwei-Stufen-Pipeline OCR → Chat (`parseWithOcrPipeline`)
- API-Key in localStorage (`ai_api_key`, Settings page). `.env` nur für E2E-Tests (`VITE_AI_API_KEY`).
- Kein Provider-Switch mehr: `getModel({ apiKey, model? })`, `sendChatMessage(messages, { apiKey, model? })`

Entfernt (2026-09-05): Anthropic, OpenAI, Meta Llama via OpenRouter, Ollama. Grund: nur Mistral
hatte die OCR-Pipeline, alle anderen liefen über den unzuverlässigeren Direkt-Vision-Pfad. Kosten
bei Mistral liegen bei ~0.5 Cent pro Rechnungsscan, eigenes GPU-Hosting lohnt sich nicht.
Früher schon entfernt: OpenRouter+Gemini (SDK-Inkompatibilitäten), Google direct (Quota), Groq (Vision eingestellt).

## Privacy / Datenschutz (Mistral)
- **Experiment (Free)**: Daten werden standardmäßig für Training verwendet. Opt-out möglich.
- **Scale (Paid)**: kein Training, reine Nutzungsabrechnung ohne Grundgebühr. Für Produktion nötig.
- Standort Frankreich (EU). Vertrag besteht direkt zwischen Nutzer und Mistral (eigener API-Key).

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
- Pricing (Stand 2026-09-05, docs.mistral.ai/inference/pricing): $4 pro 1.000 Seiten (OCR 4.x); Mistral Small 4: $0.15/M Input, $0.60/M Output
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
- Alle Modell-Aufrufe mit `temperature: 0` (Tool-Entscheidungen reproduzierbarer)
- Guard `claimsActionWithoutTool` in `sendChatMessage`: behauptet das Modell "wurde eingetragen" ohne Tool-Aufruf, wird einmal mit `toolChoice: 'required'` nachgefasst
- System-Prompt: keine wörtlichen Erfolgssätze als Beispiele — Mistral kopiert sie sonst ohne Tool-Aufruf (nur Format beschreiben)
- Lade-Blase im Chat hat zusätzlich die Klasse `chat-message-loading` (für Test-Selektoren)

## E2E Testing

### Architektur
- **`beforeEach` + `clearInstantDB`**: Jeder Test startet mit leerer Datenbank
- Tests folgen **CRUD-Paradigma**: Create → Read → Update → Delete
- Tests laufen automatisch **zweimal**: online + offline (via Network-Blocking)
- **Playwright startet Server automatisch** (Vite + InstantDB) — kein manuelles `podman-compose up` nötig
- `npm run test:e2e` führt beide Projekt-Varianten aus (146 Tests: 73 online + 73 offline; 2 weitere nur via `test:e2e:soft`)
- Playwright startet drei Server: Vite (`VITE_INSTANTDB_MODE=local`, `VITE_AI_PROXY_URL=http://localhost:8787`),
  InstantDB (podman-compose) und den AI-Proxy (`npm run dev:proxy` im Auth-Bypass, Key aus `.env` explizit per `env`)

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
| CF | Chat Flow | CF-001 bis CF-007 |
| CU | Chat Upload | CU-001 bis CU-011 |
| CM | Chat Maintenance | CM-001: add without invoice |
| SC | Schedule Flow | SC-001: chat tool |
| SH | Schedule Hint | SH-001, SH-002 |
| SE | Settings Flow | SE-001 bis SE-004 |
| CI | Chat Image | CI-001: rotation |
| CS | Chat Schedule | CS-001, CS-002 (`@soft`, nur `npm run test:e2e:soft`) |
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
| IC | Icons | IC-001: all pi-* classes exist in PrimeIcons |
| PP | Public Pages | PP-001 bis PP-004: Impressum, Datenschutz, Navigation, Redirect |
| HY | Hygiene | HY-001: keine ungenutzten Dependencies, HY-002: keine ungenutzten Komponenten |
| AP | AI Proxy | AP-001: Chat via Proxy zählt Tokens, AP-002: Monatslimit-Meldung, AP-003: Settings zeigen Abo & Nutzung |

**Gesamt: 73 Tests pro Projekt** (+2 `@soft`) — `npm run test:e2e --list` zeigt alle

### Test-Konventionen
- Tests importieren von `./fixtures/test-fixtures` statt `@playwright/test`
- PrimeVue icon-only buttons need CSS class selectors (.chat-fab), not getByRole
- .env loaded by playwright.config.ts, keys injected via page.evaluate → localStorage
- Alle AI-Tests nutzen Mistral als Default (schnell, zuverlässig, ~3–6s für Vision+Tools)
- Use .first() for assertions that may match multiple elements (AI can create duplicates)
- **KI-Tests prüfen Endzustand, nicht Formulierung:** `countEntities(page, 'vehicles')` / `waitForEntity` aus den Fixtures statt Regex auf den Antworttext. Fragt das Modell nach Bestätigung, in einer Schleife bestätigen (max. 2 Runden) und danach die DB prüfen (CF-001 als Vorlage)
- **AI-Proxy in E2E:** `clearInstantDB` löscht auch `usage`/`subscriptions` → jeder Test startet im Free-Plan bei 0.
  Nutzung setzen: `PUT http://localhost:8787/test/usage` (nur im Bypass). Der 402-Netzwerk-Log ist in IGNORED_ERRORS.
- **Weiche KI-Tests** (prüfen nur, was das Modell sagt oder nicht sagt, ohne harten Endzustand): `test.describe(..., { tag: '@soft' }, ...)`. Laufen nur im Projekt `ai-soft` via `npm run test:e2e:soft`, nicht in online/offline
- Chat-Test: Assertion auf Tool-Ergebnis muss `erledigt` einschließen (Fallback wenn Model keinen eigenen Text generiert)
- **Chat-Nachrichten zählen:** immer `.chat-message:not(.chat-message-loading)` — die Lade-Blase trägt sonst `.chat-message` mit und der Test bestätigt, bevor die Antwort da ist (Race, führte zu doppelten Rückfragen)
- Console-Error-Detection: Alle Tests failen automatisch bei unerwarteten console.error/pageerror (IGNORED_ERRORS in test-fixtures.ts)
- Offline-Tests: Alle Console-Errors werden ignoriert (InstantDB WebSocket expected)
- **SPA-Navigation testen:** `page.goto()` macht Full-Page-Load (triggert `onMounted`). Für echte SPA-Navigation: User-Interaktionen (Klicks) statt goto verwenden. Vue `onMounted` läuft nur einmal → `watch(() => route.query)` für Query-Parameter-Reaktivität

### PrimeVue Selektor-Gotchas
- `getByRole('button', { name: 'X' })` matcht Text-Buttons UND Icon-only-Buttons (beide haben aria-label)
- Für Header-Buttons mit sichtbarem Text: `button:has-text("Löschen")` statt `getByRole`
- Dialog Close-Button: `getByRole('button', { name: 'Close' })` (nicht `.pi-times` CSS-Klasse)
- VehicleDetailPage hat mehrere "Löschen"-Buttons (Header + Item-Buttons) — `.first()` oder spezifischen Container verwenden
- InputNumber: Label nur mit `input-id` verknüpft, nicht mit `id`
- `v-tooltip` Direktive muss in `main.ts` registriert werden: `app.directive('tooltip', Tooltip)`
- Labels mit `*` brechen `getByLabel` — Labels ohne `*` oder Regex verwenden

## Code Style
- German UI text and AI schema descriptions
- antfu ESLint (no semicolons, single quotes, if-newline rule)
- All source TypeScript; eslint.config.js stays .js (ESLint compat)

## InstantDB Gotchas
- Entity-IDs müssen UUIDs sein — `id()` verwenden, Hashes als separates Feld speichern
- `devtool: false` setzen — DevTools-Toggle blockiert UI-Klicks in Tests
- OCR-Cache: `tx.ocrcache[id()].update({ hash, markdown, ... })` statt `tx.ocrcache[hash].update(...)`

## Unit-Tests (Vitest)
- `src/**/*.test.ts`, Konfig `vitest.config.ts`. Proxy-Tests im Repo ai-proxy: `createApp(deps)` nimmt alles per DI
  (fetch, Store, verifyToken) → Proxy-Logik ohne Netz testbar. Stripe-Webhooks mit `generateTestHeaderString` signiert.
- Integrationstests im Repo ai-proxy (`src/stores/instant.test.ts`, `src/auth/instant.test.ts`) laufen gegen den lokalen InstantDB-Server
  und werden übersprungen, wenn er nicht läuft. Test-Token: `db.auth.createToken(email)` (Admin-SDK 0.22).

## Gotchas
- Fedora: `podman-compose` statt `docker-compose` verwenden
- Node `--env-file` überschreibt bereits exportierte Shell-Variablen **nicht**. Ein in der Shell gesetzter
  `MISTRAL_API_KEY` würde `npm run dev:proxy` übersteuern (war bis 2026-09-06 in `~/.bashrc` mit ungültigem Key,
  entfernt). Playwright gibt den `.env`-Key deshalb explizit per `env` mit.
- Der Proxy läuft mit Node-nativem Type-Stripping: relative Imports **mit `.ts`-Endung** (`./app.ts`), kein Build.
- **Kein Browser-BYOK mehr** (seit 06.09.2026): Der Client kennt keinen Mistral-Key und kein Modell, alles läuft über den Proxy. `VITE_AI_PROXY_URL` ist Pflicht.
- `pkill -f "node.ts"` killt die eigene Shell, wenn der Suchstring im Befehl steht → `pgrep -f "^node .*ai-proxy/src/node\.ts"`.
