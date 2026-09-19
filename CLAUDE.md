# Wartungsheft (Repo auto-service)

Die App läuft unter https://wartungsheft.ch (Landing Pages `/betrieb` und `/privathalter`, Login mit Magic Code, AI-Proxy unter `ai.`, InstantDB unter `api.`/`dash.`/`files.`). Betrieb und Befehle: README «Produktion», CLAUDE.md «Produktion».

Produktname «Wartungsheft» (wartungsheft.ch) in allen Texten, Titeln, Manifest und Chat-Prompts; «auto-service» bleibt nur als Repo-, Paket- und Pfadname.

Produktgrenze (business-plan/03-produkt.md «Abgrenzung»): Serviceheft mit Rechnungen, pro Fahrzeug. Kein Tankbuch, kein Fahrtenbuch,
keine Buchhaltung, keine Übernahme-Checklisten, keine Fahrer-Fahrzeug-Zuordnung oder Rollen, kein Aufpreis für Betriebe.
Zwei Preislisten, gleiche Funktionen: Privat 25 CHF im Jahr bis 5 Fahrzeuge, Betrieb 36 CHF pro Fahrzeug und Jahr
mit Rechnung auf die Firma (`plans.ts`: `yearlyPriceChf(n, audience)`, Pläne `free`, `privat`, `betrieb`).

## Commands
npm run dev          # Vite + InstantDB + AI-Proxy (startet, was nicht läuft; Proxy-Log /tmp/ai-proxy-dev.log)
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
- **Cloud (Default ohne Variable, Auslaufmodell):** instantdb.com — App-ID `5d413a89-91ad-4a5a-ad71-d2df5fd81d88`.
  Instant-Team ging 2026 zu OpenAI, keine neuen Signups, **Cloud-Abschaltung 31.08.2027**. Der lokale Proxy kann
  Cloud-Tokens nicht prüfen, Scan und Chat antworten dann mit 401.
- **Local (Entwicklung und E2E):** `VITE_INSTANTDB_MODE=local` — App-ID `cd7e6912-773b-4ee1-be18-4d95c3b20e9f`,
  Auth-Bypass im Frontend, Proxy erkennt den Nutzer am Header `x-user-id`. `scripts/dev.sh` setzt den Modus.
- **Selfhosted (Produktion):** `VITE_INSTANTDB_MODE=selfhosted` + `VITE_INSTANT_APP_ID`, `VITE_INSTANT_API_URI`,
  optional `VITE_INSTANT_WS_URI` (sonst aus API-URI abgeleitet). Echte Auth, kein Bypass.
- E2E-Tests laufen IMMER gegen lokalen Server (Playwright setzt `VITE_INSTANTDB_MODE=local`)
- `npm run dev` → Local (Vite, InstantDB, Proxy), `VITE_INSTANTDB_MODE=cloud npm run dev` → Cloud ohne Scan und Chat

### Server starten
```bash
cd ~/instant/server && podman-compose -f docker-compose-dev.yml up -d
```
Ohne Docker oder Podman (zweiter PC): Dev-InstantDB auf der Infomaniak-Instanz `wartungsheft-dev` per SSH-Tunnel auf
`localhost:8888` einblenden, Anleitung in `AGENTS.md`.

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

### Produktion (Infomaniak Public Cloud, wartungsheft.ch)
- Anleitung: `README.md` → "Produktion". Instanz `wartungsheft` (OpenStack-Projekt PCP-CTPZLR8, Region dc3-a,
  Debian 13, 2 vCPU/4 GB), Zugriff `ssh debian@195.15.207.47` mit dem lokalen Key, OpenStack-CLI über
  `~/.config/openstack/clouds.yaml` (Application Credential), DNS-API-Token in `~/.config/infomaniak/token`.
- InstantDB-Stack in `/opt/instant` (offizieller VPS-Guide + `docker-compose.override.yml`: 2-GB-Heap, Neustart,
  MinIO von quay.io, Caddy importiert `/opt/auto-service/deploy/Caddyfile` und bedient `/opt/auto-service/deploy/dist`).
  AI-Proxy in `/opt/auto-service/deploy` im Netz `instant_default`. Produktions-App-ID steht in `.env.production`.
- Frontend-URIs kommen aus `VITE_INSTANT_*` (Modus selfhosted, `.env.production`), nicht aus dem Quellcode.
- Perms: `instant-cli push perms` scheitert gegen die eigene Instanz mit «Record not found: instant-user»
  (CLI 1.0.67 gegen Server-Image `latest`); Perms deshalb als JSON im Dashboard einfügen
  (`node -e "import('./instant.perms.ts').then(m=>console.log(JSON.stringify(m.default,null,2)))"`).
- Kosten: Infomaniak Public Cloud hat keine Budget-Alarme oder Ausgabenstopps, nur Ressourcen-Quotas (Level 1: 10 Instanzen,
  20 vCPU, 64 GB, 1 TB Volumes). Deshalb ruft der tägliche Claude-Lauf auf dem Laptop (`~/projects/find-jobs/AGENTS.md`,
  «Tagescheck Wartungsheft») das Skript `~/.local/bin/wartungsheft-cost-watch` auf (`--force` sendet immer): schätzt die
  Monatskosten aus Instanzen, IPv4 und Snapshots und mailt über Resend bei > 25 CHF, bei unbekannten Flavors, Volumes oder
  Floating IPs und ab 1.12.2026 wegen Guthabenende. Kein systemd-Timer: Goran will Claude als Akteur, nicht Skripte im Hintergrund.
  Ein zweites, nur lesendes Application Credential für einen Server-Cron ist nicht möglich: Keystone verweigert das Anlegen
  von Application Credentials mit einem Application Credential.
- Backup: täglich 03:00 `/opt/backup/backup.sh` (pg_dump + MinIO-Tar nach `/opt/backups`, 14 Tage; Kopie per TempURL
  in den Swift-Container `wartungsheft-backups`, 30 Tage, Laptop-Zugriff über Cloud `PCP-CTPZLR8-backup`). Snapshot
  vor riskanten Änderungen: `openstack --os-cloud PCP-CTPZLR8-dc3-a server image create --name <name> wartungsheft`.
- Admin-SDK `@instantdb/admin` ist auf **0.22.121** gepinnt (gleiche Version wie `@instantdb/core` und der
  lokale Server-Checkout vom Feb 2026). npm-latest ist 1.x → nur zusammen mit Server + Core upgraden.
  Produktion läuft mit Server-Image `ghcr.io/instantdb/server:latest`; der 0.22-Client funktioniert dagegen.

### InstantDB vs RxDB Unterschiede
- **Entity-IDs müssen UUIDs sein** — keine beliebigen Strings (z.B. SHA-256 Hashes)
- **Schemaless** — keine Schema-Definition nötig, Felder werden dynamisch erstellt
- **Echtzeit-Sync** — Änderungen werden sofort an alle Clients gepusht
- **Offline-First** — Daten in IndexedDB, Lesen+Schreiben funktionieren offline, Sync via CRDT bei Reconnect

### Google-Login (Redirect-Flow von InstantDB)
- Login-Seite: Link «Mit Google anmelden» aus `db.auth.createAuthorizationURL({ clientName: 'google-web', redirectURL })`
  (`useAuth().googleAuthUrl()`), führt auf `https://api.wartungsheft.ch/runtime/oauth/start`, das Backend legt die Session an
  und leitet auf `/dashboard`. Gleiche E-Mail wie beim Magic Code ergibt denselben Nutzer.
- Google Cloud: Projekt `auto-service` (`gen-lang-client-0650867108`, dasselbe wie der Gemini-Key), OAuth-Client
  «Wartungsheft Web» (Typ Webanwendung, JavaScript-Quelle `https://wartungsheft.ch`, Redirect-URI
  `https://api.wartungsheft.ch/runtime/oauth/callback`), Zustimmungsbildschirm «Wartungsheft», Zielgruppe Extern,
  Status **In Produktion** (nur Scopes email/openid, darum keine Google-Prüfung nötig). Konsole: console.cloud.google.com/auth.
- Instant-Dashboard → Auth: Client `google-web` (Web, eigene Credentials), Redirect Origin `wartungsheft.ch`.
  Client-Secret liegt nur bei Google und in InstantDB, nicht im Repo.
- E2E `google-login.spec.ts` prüft nur den Link auf `/runtime/oauth/start` (Google selbst wird nicht durchlaufen).
- Apple («Sign in with Apple», 99 USD/Jahr Apple Developer Program) und GitHub bewusst nicht eingebaut.

### Anmelde-Einstieg (kein getrenntes Registrieren)
- Magic Code und Google legen das Konto beim ersten Anmelden an; `/login` ist eine Seite für neue und bestehende Konten.
- Nach jeder Anmeldung merkt sich der Browser die E-Mail (`auth:knownEmail`, `src/lib/known-account.ts`), auch nach
  dem Abmelden. `useAuthEntry` entscheidet für Kopf, Startseite und Hypothesen-Seiten: eingeloggt «Zur Übersicht»,
  bekanntes Konto nur «Anmelden» (E-Mail vorausgefüllt), sonst Link «Anmelden» plus «30 Tage gratis testen».
  Nur der Klick in die Testzeit zählt in `events`. «Andere E-Mail» auf `/login` vergisst die Adresse.
- Lokaler Modus: `auth:localSignedOut = '1'` im localStorage spielt den abgemeldeten Zustand, «Abmelden» setzt es,
  der Magic Code nimmt jeden Code an. E2E `auth-entry.spec.ts` und `landing-pages.spec.ts` starten so abgemeldet.

### Auth (Magic Codes via Resend)
- Kontaktadresse des Produkts ist `info@wartungsheft.ch` (Infomaniak-Postfach, Impressum, Datenschutz, Einstellungen,
  Antwortadresse der Erinnerungen); Claude liest und schreibt dort mit `~/.local/bin/mailbox wartungsheft …`.
- Produktion sendet über **Resend** (Region eu-west-1, Absender `login@wartungsheft.ch`); `RESEND_TOKEN` steht in
  `/opt/instant/.env`, NICHT in auto-service/.env. Lokal ohne Token: Codes stehen im Server-Log
  (`docker compose … logs server | grep postmark/send-disabled`, der Log-Name stammt aus dem Postmark-Erbe).
- Self-hosted InstantDB kennt nur Postmark, SendGrid oder Resend, kein SMTP (geprüft in `server/src/instant/config.clj`).
- DKIM-Einträge unter `_domainkey.wartungsheft.ch` liefert Infomaniak nur aus, wenn sie im Manager als Typ «DKIM» angelegt
  sind; per API (Typ TXT) angenommene Einträge bleiben stumm. CNAMEs (`rsend`, `send`) gehen per API. MX und SPF der
  Hauptdomain bleiben bei Infomaniak, Resend-Empfang ist aus. `mail.wartungsheft.ch` ist bei Resend als Reserve verifiziert.
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
- Währung, Zahlen und Datum nur über `src/lib/locale.ts` (CHF, `1'234.50`, `formatDate` → `14.09.2026`, `formatMonth`;
  bewusst ohne Intl, weil Browser und Node für de-CH verschiedene Apostrophe liefern). ISO-Daten bleiben in Formularfeldern,
  CSV und Dateinamen. Kategorie-Schlüssel (`oelwechsel`, `fahrwerk`) nie roh anzeigen, immer `categoryLabel` aus
  `src/services/report.ts`, die einzige Label-Tabelle. Kilometerstand 0 heisst unbekannt und wird weggelassen.
- Fälligkeit (`src/services/maintenance-schedule.ts`): pro Typ zählt nur der neueste Eintrag mit `status === 'done'`;
  Status `unknown` (nie erfasst, neutral), `due` (30 Tage oder 1'000 km vor dem Termin), `overdue`, `done`. Datumsrechnung
  ohne `Date`-Zeitzonen (`addMonths` mit Tagesklammerung). Dashboard und Fahrzeugkarte rechnen live aus
  `useMaintenancesStore`; `fleetDueList` (Fälligkeitsliste oben im Dashboard), `dueDescription` («fällig seit …»),
  `vehicleDueStatus` (Karte, `unknown` = «Noch keine Wartung erfasst»). Deep-Link `/dashboard#fahrzeug-<id>`.
  Status «Geplant» (gespeichert als `due`) ist ein vereinbarter Termin: über `plannedMaintenances` wird daraus
  `plannedAt` (nächster Termin in der Zukunft), die Erinnerung lässt solche Arbeiten aus. Jeder Plan-Eintrag hat einen
  eigenen `key` (Art plus Bezeichnung); kommt eine Art mehrfach vor (Getriebeöl und Differentialöl als `sonstiges`),
  entscheidet die Beschreibung der Wartung, zu welchem Eintrag sie gehört.
- Verkauft oder abgegeben statt gelöscht (`src/services/vehicle-status.ts`): `soldAt` und `soldMileage` am Fahrzeug,
  `activeVehicles` filtert Dashboard, Karten und Erinnerungen, Kosten und Exporte enthalten das Fahrzeug weiter.
- Serviceheft für den Verkauf: `buildServiceRecord` (pdf-report.ts) mit Kennzahlen aus `service-record.ts`
  (Zeitraum, Anzahl, Laufleistung, lückenlos ja/nein), Belegbildern als eigene Seiten und einer Schlussseite über
  Wartungsheft; Preise nur mit `withPrices`.
- Offline: ohne Verbindung wird der Beleg mit `scanPending` gespeichert (kein Tesseract, es lädt vom CDN),
  `useOfflineScanQueue` holt den Scan beim `online`-Ereignis nach und füllt nur leere Felder. Speicherwege dürfen
  keine Serverabfrage voraussetzen; `db.queryOnce` scheitert offline.
- Jahresabschluss: `src/services/year-export.ts` baut CSV und Belegbilder eines Jahres, `src/services/zip.ts` packt sie
  ungepackt in ein ZIP (keine Abhängigkeit, Bilder sind schon komprimiert).
- Abo und Testzeit: kein Gratis-Plan. Ohne Abo läuft eine Testzeit von 30 Tagen mit allem (ai-proxy `trial.ts`, Beginn beim
  ersten Aufruf, Subscription mit `status: 'trial'`); danach antworten Scan und Chat mit 402 `trial_expired`, Lesen,
  Erfassen von Hand und Exporte bleiben frei. Preise in `yearlyPriceChf(n, audience)` (privat 25 CHF bis 5 Fahrzeuge, Betrieb
  36 CHF pro Fahrzeug), `PriceTable.vue` mit Umschalter Privat/Betrieb rechnet damit; Fair-Use-Bremse 20 Anfragen pro Minute im Proxy (`rate-limit.ts`).
- Jahresabo Betrieb auf Rechnung: `BusinessOrderDialog.vue` in den Einstellungen (Prüfung mit `parseOrder` aus
  `@strainovic/ai-proxy/invoice`, dieselbe wie im Proxy), Proxy `/billing/order|cancel|resume` erzeugt die QR-Rechnung
  (Regeln in ai-proxy `invoice-subscription.ts`, README «8. Jahresabo auf Rechnung»). Täglicher Job `scripts/billing.ts`
  zählt Fahrzeuge und ruft `/billing/renew`, `paid <Referenz>` trägt Zahlungen ein; beide internen Endpunkte nur mit
  `AI_PROXY_INTERNAL_TOKEN`. Absender «Goran Strainovic, Strainovic IT» (Einzelfirma ohne Handelsregister, darum der
  Name des Inhabers), ohne MWST. Frontend-Code aus dem ai-proxy läuft mit `lib` ES2020: kein `replaceAll`, kein `.at()`.
- Wortwahl in der App: «Rechnung» (nie «Beleg»), «Kontrollschild» und «Fahrgestellnummer» wie auf dem Schweizer
  Ausweis (nie «Kennzeichen», «FIN»). Formular «Neues Fahrzeug» belegt nichts vor: Baujahr und Kilometerstand 0 heisst
  unbekannt, der Ausweis-Scan füllt leere Felder. Löschen eines Fahrzeugs nur auf der Fahrzeugseite, nicht auf der Karte.
  Persona-Durchgänge (Neulenker, Rentner, CEO, Fahrer) mit Screenshots auf 390px, bevor UI-Texte als fertig gelten.
- Texte: Hauptknopf überall «30 Tage gratis testen» (führt zum Login, Klick zählt in `events` über `useEventsStore`).
  Kein Lead-Formular: Fragen gehen per mailto an `info@wartungsheft.ch` (Footer aller Landing Pages, auf `/betrieb`
  zusätzlich unter dem Knopf mit Betreff). Kein Pilotangebot, keine Einrichtung vor Ort. Du-Form auch für Betriebe, bewusst.
- Speicherwege: Rechnungen immer über `saveInvoice` (`src/services/invoice-save.ts`: Rechnung, eine Wartung pro Kategorie
  mit `invoiceId`, höherer Kilometerstand, eine Transaktion; Chat, Formular und Stapel) und beim Bearbeiten über
  `updateInvoice` (zieht Datum, Kilometerstand und Positionen in die verknüpften Wartungen nach), Wartungen ohne Rechnung über
  `saveMaintenances` (`src/services/maintenance-save.ts`: Formular, «Erledigt eintragen», «Eintragen» im Wartungsplan,
  Serviceheft). Nie direkt `tx.invoices`/`tx.maintenances` aus Seiten schreiben. Jeder Speicherweg verlangt die Herkunft
  `source` (`EntrySource` in `src/services/entry-source.ts`, auch `vehiclesStore.add` und die Chat-Tools); sie ersetzt
  einen Analytics-Dienst, Auswertung in README «6. Health-Checks und Zahlen».
- Fahrzeugseite: Tabs Wartungsplan (Standard), Verlauf (erfasste Wartungen), Rechnungen, Kosten; auf 390px passen die vier
  Tabs nur mit den kurzen Namen und der Handy-Schrift aus `VehicleDetailPage.vue`. Ein Weg pro Aufgabe:
  «wann zuletzt» fragt jede Zeile des Wartungsplans selbst («Eintragen», Vorbelegung `doneFormInitial`: nie erfasst =
  Datum leer, sonst heute; Bezeichnung des Plans als Beschreibung), neue Arbeiten über «Wartung hinzufügen» im Verlauf.
  Fälligkeiten pro Fahrzeug immer über `dueForVehicle`, Status-Darstellung über `DUE_STATUS_VIEW` (beide
  `maintenance-schedule.ts`, auch im Dashboard).
- Einrichtung statt Wizard: «Fahrzeug speichern» führt auf die Fahrzeugseite, dort `SetupChecklist.vue` mit den Schritten
  aus `src/services/vehicle-setup.ts` (Fahrzeugausweis, Serviceheft, letzte Wartungen, Rechnungen). Haken folgen aus den
  Daten, nicht aus Klicks; der erste offene Schritt ist der Hauptknopf, jeder ist überspringbar, «Ausblenden» setzt
  `setupHidden` am Fahrzeug. Der Ausweis-Scan im Fahrzeugformular geht auch beim Bearbeiten (füllt nur leere Felder).
- Serviceheft ohne Chat: `ServiceBookDialog.vue` (Wartungsplan «Serviceheft fotografieren», Checkliste, Dashboard-Hinweis) mit
  `useServiceBookScan` (Fotos oder PDF) und reiner Logik in `src/services/service-book.ts` (Intervall-Zeilen, Hersteller-
  Intervalle einmischen, Stempel als Vorschläge mit Duplikatprüfung 14 Tage). Speichert `customSchedule` komplett.
- Fehler an Nutzer nur über `userMessage` in `src/lib/errors.ts` (402/429/Netz/Auth in deutsche Sätze; die Limit-Meldung
  des ai-proxy geht unverändert durch, sie nennt Kontingent und Plan). Technische Details nur in der Konsole.
- E-Mail-Erinnerungen: reine Logik in `src/services/reminders.ts` (pro Nutzer eine Mail mit `due`/`overdue`, Schlüssel
  gegen Wiederholung, 30 Tage), Server-Job `scripts/reminders.ts` (Admin-API + Resend, gebündelt nach
  `deploy/reminders.mjs`, Cron auf der Instanz, README «7. E-Mail-Erinnerungen»), Nutzer-Schalter im Store
  `src/stores/reminders.ts` (Entität `settings`, ein Dokument pro `creatorId`, fehlt = eingeschaltet).
- Löschen kaskadiert: Fahrzeug über `vehiclesStore.removeWithRelated` (Rechnungen und Wartungen mit), Rechnung löscht
  ihre Wartungen über `invoiceId`; Wartungen aus `add_invoice` tragen die `invoiceId`.
- Kostentabelle: `total` ist der Rechnungsbetrag (brutto), Positionen sind oft netto; die Differenz erscheint als Kategorie
  `nicht_zugeordnet` («Nicht zugeordnet / MwSt.»), damit die Zeilen zur Total-Zeile addieren.
- Auswertungen und Exporte: `src/services/report.ts` (Kosten pro Jahr und Kategorie, Fuhrpark pro Fahrzeug und Jahr, CSV mit
  BOM und Semikolon für Excel de-CH, reine Funktionen) und `src/services/pdf-report.ts` (jsPDF + jspdf-autotable; Dossier pro
  Fahrzeug mit Stammdaten, Wartungen, Kosten, Rechnungen; Fuhrpark-Übersicht = Übersichtsseite plus dieselben Abschnitte je
  Fahrzeug über `renderVehicle`). UI: Tab «Kosten» auf der Fahrzeugseite (CSV, PDF-Dossier), Fuhrpark-Tabelle auf dem
  Dashboard (CSV, PDF-Übersicht), Downloads über Blob-Links; E2E `report-export.spec.ts` und `fleet-costs.spec.ts` prüfen
  Tabellen und Dateien.
- Fremde Währungen: `src/services/fx.ts` holt EZB-Referenzkurse zum Rechnungsdatum von `api.frankfurter.dev` (kein Schlüssel,
  Cache im localStorage) und rechnet in die Heimwährung aus den Einstellungen um (`settings.homeCurrency`, CHF oder EUR).
  Ohne Kurs bleibt die Rechnung in ihrer Währung, sichtbar als «nicht umgerechnet». In E2E-Tests die API mit `page.route`
  mocken, und zwar **vor** `clearInstantDB`, sonst holt das Dashboard beim Aufräumen den echten Kurs in den Cache.
- Die Stores `invoices` und `maintenances` halten alle Einträge des Kontos; Seiten für ein Fahrzeug filtern mit
  `getByVehicleId`, nie direkt `store.invoices` verwenden.
- AI SDK v6: `inputSchema` (not `parameters`), `stopWhen: stepCountIs(n)` (not maxSteps)
- Chat tools write directly to InstantDB — no REST API layer
- Chat stepCount=5 (Phase 2), dynamisch höher für PDF mit vielen Seiten
- Chat-Verlauf wird in InstantDB `chatmessages` Entity persistiert
- >8 Bilder: OCR-Text wird verwendet, Bilder nicht an Vision-Modell gesendet
- Regelbasierte Kategorie-Korrektur: Keywords überschreiben AI-Zuordnung (z.B. "Auspuff" → auspuff), einzige Quelle
  `src/services/category-correction.ts` (Chat und Formular)
- Fahrzeugausweis-Scan im Formular «Neues Fahrzeug» (`src/composables/useVehicleScan.ts`, Bereinigung in
  `src/services/vehicle-scan.ts`): Foto nicht pauschal hochkant drehen (`expectPortrait: false`, der Ausweis liegt quer),
  Prompt kennt die nummerierten Felder des Schweizer Ausweises (15 Schild, 21 Marke und Typ, 23 Fahrgestell-Nr.,
  36 1. Inverkehrsetzung). Test-Bild ist der gemeinfreie Ausweis von Wikimedia (`e2e/fixtures/LIZENZEN.md`).
- Nachkontrolle der Positionen (`src/services/invoice-items.ts`), für Chat, Formular und Sammel-PDF: ergeben die
  Positionen mehr als das Total, werden aufeinanderfolgende Positionen mit gleichem Betrag zusammengefasst (typisch:
  mehrere Beschreibungszeilen unter einer Arbeitszeile), nur wenn die Summe danach passt. Bleibt die Summe zu hoch,
  zeigt das Formular einen Hinweis. Wartungen aus einer Rechnung: eine pro Kategorie (`maintenancesFromItems`).
- Beleg-Scan im Formular «+ Rechnung hinzufügen» (`src/composables/useInvoiceScan.ts`): Foto verkleinern und ausrichten
  (`autoRotateForDocument`, Regel in `src/lib/orientation.ts`: Querformat immer drehen, Hochformat nur ab
  OSD-Sicherheit 2), dann `parseInvoice`. PDF über `parseInvoicesPdf`: OCR aller Seiten, dann **jede Seite einzeln**
  auswerten (Art rechnung/fortsetzung/andere) und mit `mergePdfPages` zusammenführen; ein Aufruf fürs ganze PDF liess
  Rechnungen aus und übertrug die Werkstatt. Eine Rechnung füllt nur leere Formularfelder (`fillEmptyFields`), mehrere
  (Sammel-PDF oder mehrere Fotos) erscheinen als Prüfliste (`buildBatch`): Duplikat = gleicher Betrag und Datum höchstens
  14 Tage auseinander. Datum der Rechnung ist das Reparaturdatum, falls vorhanden. E2E: Mistral mit `mockInvoiceScan`
  abfangen; echter Test mit Fotos und 9-Seiten-PDF aus `tmp/`: `npx playwright test e2e/invoice-scan-real.spec.ts --project=ai-soft`.
- PDF-Upload: max 50 MB, OCR pro Seite, Duplikat-Erkennung bei identischen Seiten
- `scan_document` Tool wird ausgeblendet wenn Bilder im Message sind (Modell sieht Bilder direkt)
- `add_maintenance` Tool: Wartung OHNE Rechnung eintragen (z.B. manuell berichtete Arbeiten)
- Chat: Kamera-Button (capture="environment"), Drag & Drop, Multi-PDF-Upload, Maximize mit 30/70 Split
- Chat Tool Results: `sendChatMessage` gibt `{ text, toolResults? }` zurück, ToolResultCard als PrimeVue Panel
- AI SDK v6: Tool-Ergebnisse in `tr.output` (nicht `tr.result`), `tr.toolName` für Tool-Name
- z.enum(MAINTENANCE_CATEGORIES) enforces valid categories in AI schemas
- InstantDB: Entity-IDs müssen UUIDs sein (nutze `id()` Funktion)
- Alle Modell-Aufrufe mit `temperature: 0` (Tool-Entscheidungen reproduzierbarer)
- Guard `claimsActionWithoutTool` (`src/services/chat-guard.ts`, reine Funktion mit Unit-Test) in `sendChatMessage`:
  behauptet das Modell «eingetragen» ohne Aufruf eines **schreibenden** Tools (`WRITE_TOOLS`; ein `list_vehicles` allein
  zählt nicht), wird einmal mit `toolChoice: 'required'` nachgefasst, und zwar nur im ersten Schritt (`prepareStep`): nach
  dem Tool-Ergebnis antwortet Mistral auf `tool_choice: "any"` nie. Muster: Partizip mit Hilfsverb, vor `:`/`.`/Ende, oder ✅
- System-Prompt: keine wörtlichen Erfolgssätze als Beispiele — Mistral kopiert sie sonst ohne Tool-Aufruf (nur Format beschreiben)
- Lade-Blase im Chat hat zusätzlich die Klasse `chat-message-loading` (für Test-Selektoren)

## E2E Testing

### Architektur
- **`beforeEach` + `clearInstantDB`**: Jeder Test startet mit leerer Datenbank
- Tests folgen **CRUD-Paradigma**: Create → Read → Update → Delete
- Tests laufen automatisch **zweimal**: online + offline (via Network-Blocking)
- **Playwright startet Server automatisch** (Vite + InstantDB) — kein manuelles `podman-compose up` nötig
- `npm run test:e2e` führt beide Projekt-Varianten aus (272 Tests: 136 online + 136 offline; 8 weitere nur via `test:e2e:soft`)
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
| PP | Public Pages | PP-001 bis PP-004: Impressum, Datenschutz, Navigation, Redirect |
| HY | Hygiene | HY-001: keine ungenutzten Dependencies, HY-002: keine ungenutzten Komponenten, HY-003: kein Tooltip wiederholt die Knopf-Beschriftung |
| AP | AI Proxy | AP-001: Chat via Proxy zählt Tokens, AP-002: Monatslimit-Meldung, AP-003: Settings zeigen Abo & Nutzung |
| DJ | Fälligkeit als Ablauf | DJ-001 bis DJ-007: Wartungsplan nach dem Anlegen, Fälligkeitsliste, «Erledigt eintragen», Mail-Link, Termin, km |
| SB | Serviceheft ohne Chat | SB-001 bis SB-003: Scan, Duplikate, Intervalle von Hand |
| IE | Rechnung bearbeiten | IE-001, IE-002: Datum und km nachziehen, Positionen abgleichen |
| SV | Verkauft oder abgegeben | SV-001, SV-002: raus aus Fälligkeiten, Kosten bleiben, rückgängig |
| EF | Einrichtung Fahrzeug | EF-001 bis EF-006: Checkliste nach dem Anlegen, Wartungsplan fragt «zuletzt», Serviceheft-Knopf, Verlauf, Ausblenden |
| HK | Herkunft am Datensatz | HK-001 bis HK-004: `source` bei Formular, Rechnung samt Wartungen, Wartungsplan, Dashboard |
| AE | Anmelde-Einstieg | AE-001 bis AE-003: «Anmelden» im Kopf auf 390px, bekanntes Konto nach Abmelden, «Andere E-Mail» |
| BO | Bestellung Betrieb | BO-001, BO-002: Jahresabo mit Rechnungsadresse, Fahrzeuge vorbelegt, Storno bei Kündigung in der Testzeit, Feldfehler |

**Gesamt: 136 Tests pro Projekt** (+8 `@soft`) — `npm run test:e2e --list` zeigt alle

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

### PrimeVue Selektor-Gotchas
- `getByRole('button', { name: 'X' })` matcht Text-Buttons UND Icon-only-Buttons (beide haben aria-label)
- Für Header-Buttons mit sichtbarem Text: `button:has-text("Löschen")` statt `getByRole`
- Dialog Close-Button: `getByRole('button', { name: 'Close' })` (nicht `.pi-times` CSS-Klasse)
- VehicleDetailPage hat mehrere "Löschen"-Buttons (Header + Item-Buttons) — `.first()` oder spezifischen Container verwenden
- InputNumber: Label nur mit `input-id` verknüpft, nicht mit `id`
- `v-tooltip` Direktive muss in `main.ts` registriert werden: `app.directive('tooltip', Tooltip)`
- Labels mit `*` brechen `getByLabel` — Labels ohne `*` oder Regex verwenden

## Abläufe prüfen, nicht nur Seiten

Lücken wie «der Chat liest den Fahrzeugausweis, das Formular nicht» sieht man auf keiner einzelnen Seite. Vor einer
Fertigmeldung bei Änderungen an Formularen, Chat-Tools oder Navigation die betroffenen Kernabläufe durchgehen und
prüfen, ob jeder Einstieg (Dashboard, Fahrzeugliste, Fahrzeugseite, Formular, Chat, E-Mail-Link, Handy) dasselbe kann:

1. Neues Fahrzeug erfassen (leeres Dashboard und weiteres Fahrzeug)
2. Erste Rechnung und alte Belege nachtragen (Foto, mehrere Fotos, Sammel-PDF)
3. Wartung ohne Rechnung eintragen
4. Serviceheft-Intervalle hinterlegen und Fälligkeiten verstehen
5. Kosten exportieren (ein Fahrzeug, alle Fahrzeuge)
6. Erinnerung erhalten und Arbeit als erledigt eintragen
7. Fahrzeug verkaufen oder abgeben
8. Kilometerstand aktuell halten
9. Betrieb: über alle Fahrzeuge sehen, was fällig ist

KI-Funktionen zusätzlich mit echtem Material testen, nicht nur mit Mocks: Fotos und PDF in `tmp/` (lokal),
Fahrzeugausweis in `e2e/fixtures/`, `npx playwright test e2e/invoice-scan-real.spec.ts --project=ai-soft`.

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
