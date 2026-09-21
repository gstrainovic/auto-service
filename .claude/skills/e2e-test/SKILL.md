---
name: e2e-test
description: >
  Playwright-E2E-Tests ausführen, filtern, debuggen — und Aufbau/Konventionen der Suite (Architektur, Offline, Test-ID-Schema, PrimeVue-Selektoren). Use when E2E-Tests ausgeführt, geschrieben, gelesen oder repariert werden, Test-IDs vergeben werden oder Selektor-/Race-Probleme mit PrimeVue, clearInstantDB, simulateOffline oder dem AI-Proxy auftreten.
---

Führe Playwright E2E-Tests aus.

## Befehle
- Alle Tests: `npm run test:e2e`
- Einzelner Test: `npm run test:e2e -- --grep "VF-001"`
- Test-Gruppe: `npm run test:e2e -- --grep "vehicle-flow"`
- UI-Modus: `npm run test:e2e:ui`
- Liste alle Tests: `npm run test:e2e -- --list`
- Weiche KI-Tests (`@soft`): `npm run test:e2e:soft`

## Voraussetzungen
1. InstantDB Server muss laufen (nutze `/instantdb-start`)
2. Dev-Server startet automatisch via Playwright

Aus der früheren CLAUDE.md hierher verschoben (21.09.2026), Wortlaut unverändert.

## E2E Testing

### Architektur
- **`beforeEach` + `clearInstantDB`**: Jeder Test startet mit leerer Datenbank
- Tests folgen **CRUD-Paradigma**: Create → Read → Update → Delete
- Tests laufen automatisch **zweimal**: online + offline (via Network-Blocking)
- **Playwright startet Server automatisch** (Vite + InstantDB) — kein manuelles `podman-compose up` nötig
- `npm run test:e2e` führt beide Projekt-Varianten aus (284 Tests: 142 online + 142 offline; 8 weitere nur via `test:e2e:soft`)
- Playwright startet drei Server: Vite (`VITE_INSTANTDB_MODE=local`, `VITE_AI_PROXY_URL=http://localhost:8787`),
  InstantDB (podman-compose) und den AI-Proxy (`npm run dev:proxy` im Auth-Bypass, Key aus `.env` explizit per `env`,
  `AI_PROXY_BURST_LIMIT=10000`, weil alle Tests einen Nutzer teilen und die Fair-Use-Bremse sonst 429 liefert)
- Läuft der Proxy schon (Playwright nimmt den bestehenden Port 8787), muss er selbst mit `AI_PROXY_BURST_LIMIT=10000`
  und den `INVOICE_*`-Werten aus `playwright.config.ts` gestartet sein, sonst fallen Chat-Tests mit «429 (Too Many
  Requests)» und die Bestell-Tests mit 501. Der Proxy lädt Code nicht neu: nach Änderungen im ai-proxy beenden.

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
| PP | Public Pages | PP-001 bis PP-008: Impressum, Datenschutz, Navigation, Redirect, AGB, Hilfe, Metadaten, robots/sitemap/llms |
| HY | Hygiene | HY-001: keine ungenutzten Dependencies, HY-002: keine ungenutzten Komponenten, HY-003: kein Tooltip wiederholt die Knopf-Beschriftung |
| AP | AI Proxy | AP-001: Chat via Proxy zählt Tokens, AP-002: Monatslimit-Meldung, AP-003: Settings zeigen Abo & Nutzung |
| DJ | Fälligkeit als Ablauf | DJ-001 bis DJ-007: Wartungsplan nach dem Anlegen, Fälligkeitsliste, «Erledigt eintragen», Mail-Link, Termin, km |
| SB | Serviceheft ohne Chat | SB-001 bis SB-003: Scan, Duplikate, Intervalle von Hand |
| IE | Rechnung bearbeiten | IE-001, IE-002: Datum und km nachziehen, Positionen abgleichen |
| SV | Verkauft oder abgegeben | SV-001, SV-002: raus aus Fälligkeiten, Kosten bleiben, rückgängig |
| EF | Einrichtung Fahrzeug | EF-001 bis EF-006: Checkliste nach dem Anlegen, Wartungsplan fragt «zuletzt», Serviceheft-Knopf, Verlauf, Ausblenden |
| HK | Herkunft am Datensatz | HK-001 bis HK-004: `source` bei Formular, Rechnung samt Wartungen, Wartungsplan, Dashboard |
| AE | Anmelde-Einstieg | AE-001 bis AE-003: «Anmelden» im Kopf auf 390px, bekanntes Konto nach Abmelden, «Andere E-Mail» |
| BO | Bestellung Abo | BO-001 bis BO-004: Betrieb mit Rechnungsadresse, Feldfehler, Privat ohne Firma, Preis ab sechs Fahrzeugen |
| LP | Landing Pages | LP-001 bis LP-004: Betrieb, Privathalter, Startseite, Film |
| DI | Diktieren | DI-001 bis DI-003: Chat-Eingabe, Beschreibung im Wartungsformular, ganze Rechnung ansagen |
| FB | Rückmeldung | FB-001 bis FB-003: Text senden, Adresse kopieren, Sprachnachricht |
| TN | Testzeit-Hinweis | TN-001 bis TN-003: Hinweis in der letzten Woche, vorher still, ohne Kaufweg gar nicht |

**Gesamt: 142 Tests pro Projekt** (+8 `@soft`) — `npm run test:e2e --list` zeigt alle

### Test-Konventionen
- Tests importieren von `./fixtures/test-fixtures` statt `@playwright/test`
- **Seeds über `db.transact` erst nach `waitForInstantDB(page)`** (Fixture): wartet auf `__instantdb` **und** Verbindungsstatus
  `authenticated`. Direkt nach `page.goto` ist die Verbindung noch `opened`, `transact` löst dann mit `enqueued` auf, und das
  nächste `page.goto` verliert die Mutation. Lokal mit Podman kaum sichtbar, über den SSH-Tunnel zur Dev-Instanz jeder zehnte Seed.
- PrimeVue icon-only buttons need CSS class selectors (.chat-fab), not getByRole
- Nach «Fahrzeug speichern» steht die App auf der Fahrzeugseite (`waitForURL(/\/vehicles\/.+/)`), nicht mehr in der Liste;
  wer die Karte prüft, geht danach mit `page.goto('/vehicles')` zurück. Standard-Tab ist Wartungsplan, der Verlauf
  (`.maintenance-item`, «Wartung hinzufügen») braucht vorher einen Klick auf den Tab «Verlauf». «Serviceheft
  fotografieren» steht in Checkliste und Wartungsplan, darum über `.plan-source` eingrenzen.
- `offline` hängt von `online` ab: `--project=offline` allein startet alle Online-Tests mit, für einzelne Specs `--no-deps`
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
- `clearInstantDB()` löscht via Client-API (nicht SQL)
- Screenshots bei Fehlern: `test-results/**/test-failed-*.png`

### PrimeVue Selektor-Gotchas
- `getByRole('button', { name: 'X' })` matcht Text-Buttons UND Icon-only-Buttons (beide haben aria-label)
- Für Header-Buttons mit sichtbarem Text: `button:has-text("Löschen")` statt `getByRole`
- Dialog Close-Button: `getByRole('button', { name: 'Close' })` (nicht `.pi-times` CSS-Klasse)
- VehicleDetailPage hat mehrere "Löschen"-Buttons (Header + Item-Buttons) — `.first()` oder spezifischen Container verwenden
- InputNumber: Label nur mit `input-id` verknüpft, nicht mit `id`
- `v-tooltip` Direktive muss in `main.ts` registriert werden: `app.directive('tooltip', Tooltip)`
- Labels mit `*` brechen `getByLabel` — Labels ohne `*` oder Regex verwenden
