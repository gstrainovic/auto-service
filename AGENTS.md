# Wartungsheft: Arbeitswissen für Agenten

Einstiegsdatei für dieses Repo; `CLAUDE.md` zieht sie per `@AGENTS.md` herein. Selten gebrauchte Bereiche liegen
in `.claude/skills/` und werden bei Bedarf geladen — Übersicht am Ende unter «Themen in Skills».

Die App läuft unter https://wartungsheft.ch (Landing Pages `/betrieb` und `/privathalter`, Login mit Magic Code, AI-Proxy unter `ai.`, InstantDB unter `api.`/`dash.`/`files.`). Betrieb und Befehle: README «Produktion», Skill `instantdb-betrieb` «Produktion».

Produktname «Wartungsheft» (wartungsheft.ch) in allen Texten, Titeln, Manifest und Chat-Prompts; «auto-service» bleibt nur als Repo-, Paket- und Pfadname.
Logo ist `public/favicon.svg` (Serviceheft mit Haken, `#059669`), in Seiten nur über `AppLogo.vue`; PWA-Icons daraus mit
`resvg` rendern. `pi pi-car` steht für Fahrzeuge, nie für die Marke.

Produktgrenze (business-plan/03-produkt.md «Abgrenzung»): Serviceheft mit Rechnungen, pro Fahrzeug. Kein Tankbuch, kein Fahrtenbuch,
keine Buchhaltung, keine Übernahme-Checklisten, keine Fahrer-Fahrzeug-Zuordnung oder Rollen, kein Aufpreis für Betriebe.
Zwei Preislisten, gleiche Funktionen: Privat 25 CHF im Jahr bis 5 Fahrzeuge, Betrieb 36 CHF pro Fahrzeug und Jahr
mit Rechnung auf die Firma (`plans.ts`: `yearlyPriceChf(n, audience)`, Pläne `free`, `privat`, `betrieb`).

## Zu Beginn jeder Sitzung: Repos aktualisieren

Bevor irgendeine Arbeit beginnt, zuerst dieses Repo und danach die beiden Hilfs-Repos pullen. Gearbeitet wird auf
zwei Rechnern (Windows und Fedora), ein veralteter Stand führt sonst zu Konflikten oder zu Arbeit an überholtem Code:

```bash
git pull --ff-only
git -C ../business pull --ff-only
git -C ../ai-proxy pull --ff-only
```

Scheitert ein Pull (lokale Änderungen, abweichende Historie), nicht selbst auflösen, sondern melden und nachfragen.

`todo.md` ist öffentlich, `../business` privat: Punkte mit geschäftlichem Inhalt (Preise, Anbieter, Kanäle, Texte,
Termine, Konditionen) stehen in `todo.md` nur als eine Zeile mit Verweis auf die Stelle in `../business`
(bzw. `business-plan/`), die Einzelheiten nur dort.
Bringt der Pull in `../ai-proxy` neue Abhängigkeiten, danach dort und hier `npm install`.

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
e2e/              # Playwright tests + fixtures/ (Code)
testdateien/      # Testbilder für E2E und manuelles Ausprobieren, Übersicht und Lizenzen in README.md
scripts/          # dev.sh (Vite + InstantDB), test-9-images.ts (manueller OCR-Pipeline-Test)
tmp/              # Testbilder + 9-Seiten-PDF für manuelle Tests (gitignored, NICHT löschen)

## InstantDB
Backend-Datenbank mit Echtzeit-Sync via WebSocket. Ersetzt RxDB. Betrieb, Produktion und Auth im Detail: Skill `instantdb-betrieb`.

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
`localhost:8888` einblenden, Anleitung unten unter «Entwickeln ohne Docker».

### Server stoppen
```bash
cd ~/instant/server && podman-compose -f docker-compose-dev.yml down
```

### Konfiguration
- App-ID: `cd7e6912-773b-4ee1-be18-4d95c3b20e9f`
- HTTP API: Via Vite-Proxy `/instant-api → localhost:8888`
- WebSocket: `ws://localhost:8888/runtime/session`
- Server-Config: `~/instant/server/resources/config/override.edn`
- DevTools deaktiviert (Toggle-Button blockierte UI-Klicks)

## Entwickeln ohne Docker: Dev-InstantDB auf Infomaniak per SSH-Tunnel

Alles im Repo spricht InstantDB nur über `localhost:8888` an (`instant-config.ts`, Vite-Proxy `/instant-api`, `scripts/dev.sh`,
Playwright, die Offline-Fixture). Darum reicht auf einem PC ohne Docker oder Podman ein SSH-Tunnel zu einer Dev-Instanz;
am Code ändert sich nichts.

- **Instanz** `wartungsheft-dev` im selben OpenStack-Projekt wie die Produktion (PCP-CTPZLR8, dc3-a, Flavor
  `a2-ram4-disk50-perf1`, Debian 13, Docker CE), Zugriff `ssh debian@195.15.207.253` mit dem Key `claude-laptop`.
  Security Group `default`: nur 22, 80 und 443 offen; der Stack bindet 8888 ausschliesslich auf `127.0.0.1`.
- **Stack** in `/opt/instant`: `docker-compose.dev.yml` (Postgres 17, MinIO, `ghcr.io/instantdb/server:latest` mit 2-GB-Heap,
  gleiche Images wie Produktion, ohne Caddy und Dashboard), Passwörter in `/opt/instant/.env`, AEAD-Schlüssel des
  Servers im Volume `instant_server_config` (`override.edn`, derselbe wie im lokalen Dev-Checkout, damit der Dump lesbar bleibt).
- **Daten**: Dump der lokalen Dev-Datenbank vom 18.09.2026, also dieselbe App `cd7e6912-773b-4ee1-be18-4d95c3b20e9f`
  (`LOCAL_APP_ID`) mit demselben Admin-Token wie in `.env`. Die E2E-Tests leeren die App vor jedem Test, Daten dort sind Wegwerfdaten.
- **Ablauf auf dem anderen PC** (braucht Node, Git, Playwright-Browser, den SSH-Key und `.env` aus der Mail an sich selbst):

  ```bash
  ssh -N -L 8888:localhost:8888 debian@195.15.207.253 &   # Tunnel, läuft im Hintergrund
  npm run dev          # dev.sh sieht «InstantDB already running», startet nur Vite und AI-Proxy
  npm run test:e2e     # Playwright übernimmt den laufenden Port 8888 (reuseExistingServer)
  ```

  Kein Podman, kein `~/instant`-Checkout nötig. Offline-Tests funktionieren, sie blockieren `localhost:8888` im Browser.
- **Stack bedienen** (auf der Instanz, in `/opt/instant`): `docker compose -f docker-compose.dev.yml --env-file .env ps|logs|restart server`.
  Nach `up -d` dauert es rund eine Minute, bis 8888 antwortet; `curl localhost:8888/health/system` muss `{"wal":"ok"}` liefern.
- **Kosten**: läuft sie, kostet sie wie die Produktion (rund 13 CHF im Monat mit IPv4). Wird sie länger nicht gebraucht:
  `openstack --os-cloud PCP-CTPZLR8-dc3-a server shelve wartungsheft-dev` (kein CPU/RAM/Disk mehr, nur Snapshot und IPv4,
  IP bleibt), zurück mit `server unshelve`, danach `up -d` läuft dank `restart: unless-stopped` von selbst.
  Der Kostenwächter `~/.local/bin/wartungsheft-cost-watch` rechnet geshelvte Instanzen ohne Compute, Limit 30 CHF.
- **Neu aufsetzen**: Dump der lokalen Dev-DB (`podman exec server_postgres_1 pg_dump -U instant -Fc instant > dev.dump`)
  nach `/opt/instant`, dann `pg_restore -U instant -d instant --no-owner < dev.dump` in den laufenden Postgres,
  `truncate attr_sketches, wal_aggregator_status, wal_logs` (abgeleitete Daten, sonst stirbt der Serverstart an
  Duplikaten, siehe README «Backup») und `delete from config where k = 'wal-errors'` (der Dump trägt sonst den
  WAL-Fehler eines längst toten Prozesses mit, `/health/system` bleibt dann auf `{"wal":"error"}`), dann `up -d`.
- **Nicht**: die Produktionsinstanz für Entwicklung mitnutzen. 4 GB RAM sind mit dem 2-GB-Heap der Produktion belegt,
  und ein zweiter Stack auf derselben Maschine gefährdet die Kundendaten.

## AI Provider: nur Mistral

Welches Modell an welchen Endpunkt gehört, sagt `GET /v1/models`: das Feld `capabilities` unterscheidet
`completion_chat`, `audio_transcription`, `audio_transcription_realtime` und `audio_speech`. Produktnamen aus der
Dokumentation sind keine Modell-IDs.
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

Grenzen, Rate-Limits und Datenschutz von Mistral: Skill `mistral-limits`.

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
- Abo und Testzeit: kein Gratis-Plan. In der letzten Woche der Testzeit steht auf dem Dashboard ein Hinweis
  (`trialNotice`), sieben Tage vor Schluss geht eine Mail raus (`buildTrialReminders`, beide
  `src/services/trial-reminder.ts`, Versand im Job `scripts/reminders.ts`, ein Merker `lastTrialNoticeKey` je Testzeit).
  Ohne Abo läuft eine Testzeit von 30 Tagen mit allen Funktionen und dem Kontingent des Privatplans (ai-proxy `trial.ts`, Beginn beim
  ersten Aufruf, Subscription mit `status: 'trial'`); danach antworten Scan und Chat mit 402 `trial_expired`, Lesen,
  Erfassen von Hand und Exporte bleiben frei. Preise in `yearlyPriceChf(n, audience)` (privat 25 CHF bis 5 Fahrzeuge, Betrieb
  36 CHF pro Fahrzeug), `PriceTable.vue` mit Umschalter Privat/Betrieb rechnet damit; Fair-Use-Bremse 20 Anfragen pro Minute im Proxy (`rate-limit.ts`).
- Kaufweg: `/me/usage` meldet `ordering`, sobald der Proxy Rechnungen ausstellt. Mit `INVOICE_IBAN` erzeugt und
  verschickt er die QR-Rechnung selbst; ohne IBAN, aber mit Postfach (`INVOICE_EMAIL`, ersatzweise `FEEDBACK_TO`),
  legt er das Abo gleich an (Nummer, SCOR-Referenz) und schickt nur den Auftrag «Rechnung schreiben» an
  `info@wartungsheft.ch` (ai-proxy `invoice-request.ts`, Antwort `manual: true`); Verlängerung und Storno ebenso.
  So läuft die Produktion, bis das Geschäftskonto da ist, und so laufen die E2E-Tests. Ohne beides zeigt die App
  weder Bestellknopf noch Testzeit-Hinweis.
- Jahresabo auf Rechnung, privat und für Betriebe: `OrderDialog.vue` in den Einstellungen mit Umschalter Privat/Betrieb
  (privat ohne Firmenfeld, `Order.audience` steuert Pflichtfelder, Preis, Plan und die Texte auf Rechnung und Mail;
  die Zielgruppe steht am Abo und gilt bei jeder Verlängerung; Prüfung mit `parseOrder` aus
  `@strainovic/ai-proxy/invoice`, dieselbe wie im Proxy), Proxy `/billing/order|cancel|resume` erzeugt die QR-Rechnung
  (Regeln in ai-proxy `invoice-subscription.ts`, README «8. Jahresabo auf Rechnung»). Täglicher Job `scripts/billing.ts`
  zählt Fahrzeuge und ruft `/billing/renew`, `paid <Referenz>` trägt Zahlungen ein; beide internen Endpunkte nur mit
  `AI_PROXY_INTERNAL_TOKEN`. Absender «Goran Strainovic, Strainovic IT» (Einzelfirma ohne Handelsregister, darum der
  Name des Inhabers), ohne MWST. Frontend-Code aus dem ai-proxy läuft mit `lib` ES2020: kein `replaceAll`, kein `.at()`.
- AGB unter `/agb` (`AgbPage.vue`, Footer und Bestelldialog verlinken sie) geben die Regeln aus `trial.ts`,
  `invoice-subscription.ts` und `plans.ts` wieder; wer dort Testzeit, Fristen oder Preise ändert, passt die AGB mit an
  und kündigt die Änderung den Kunden 30 Tage vorher per Mail an (AGB Ziffer 13).
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
  Derselbe Job meldet neue Anmeldungen an `info@wartungsheft.ch` (`src/services/signup-notice.ts`, Merker
  `settings.signupNoticeAt`).
- Löschen kaskadiert: Fahrzeug über `vehiclesStore.removeWithRelated` (Rechnungen und Wartungen mit), Rechnung löscht
  ihre Wartungen über `invoiceId`; Wartungen aus `add_invoice` tragen die `invoiceId`.
- Konto löschen (Einstellungen, Karte «Konto», AGB Ziffer «Deine Daten»): `deleteWholeAccount` in
  `src/services/account-delete.ts` löscht erst die eigenen Entitäten (`OWNED_ENTITIES`) über den Client, dann ruft
  `deleteAccount` den Proxy `POST /me/delete` (Verbrauch, Testzeit, Login per Admin-SDK; ein Abo mit gestellten
  Rechnungen bleibt gekündigt als Beleg, `retireSubscription`). Reihenfolge fest: nach dem Login wäre keine
  Transaktion mehr möglich. Danach `signOut`, `forgetKnownAccount`, Startseite. Nur online.
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
  36 1. Inverkehrsetzung). Test-Bild ist der gemeinfreie Ausweis von Wikimedia (`testdateien/README.md`).
- Nachkontrolle der Positionen (`src/services/invoice-items.ts`), für Chat, Formular und Sammel-PDF: ergeben die
  Positionen mehr als das Total, werden aufeinanderfolgende Positionen mit gleichem Betrag zusammengefasst (typisch:
  mehrere Beschreibungszeilen unter einer Arbeitszeile), nur wenn die Summe danach passt. Bleibt die Summe zu hoch,
  zeigt das Formular einen Hinweis. Wartungen aus einer Rechnung: eine pro Kategorie (`maintenancesFromItems`).
- Beleg-Scan im Formular «+ Rechnung hinzufügen» (`src/composables/useInvoiceScan.ts`): Foto verkleinern und ausrichten
  (`autoRotateForDocument`, Regel in `src/lib/orientation.ts`: Querformat immer drehen, Hochformat nur ab
  OSD-Sicherheit 2), dann `parseInvoice`. PDF über `parseInvoicesPdf`: OCR aller Seiten, dann **jede Seite einzeln**
  auswerten (Art rechnung/fortsetzung/andere) und mit `mergePdfPages` zusammenführen; ein Aufruf fürs ganze PDF liess
  Rechnungen aus und übertrug die Werkstatt. Mistral ordnet die Seitenart nicht stabil zu, darum feste Regeln in
  `mergePdfPages`: das Total einer Fortsetzung gilt (Kopfseiten ohne Total bekommen sonst die Summe ihrer Positionen),
  gleiche Werkstatt und gleiches Datum wie die Vorseite bei anderem Betrag = Fortsetzung, andere Werkstatt = neue Rechnung.
  Eine Rechnung füllt nur leere Formularfelder (`fillEmptyFields`), mehrere
  (Sammel-PDF oder mehrere Fotos) erscheinen als Prüfliste (`buildBatch`): Duplikat = gleicher Betrag und Datum höchstens
  14 Tage auseinander. Datum der Rechnung ist das Reparaturdatum, falls vorhanden. E2E: Mistral mit `mockInvoiceScan`
  abfangen. Echter Test gegen Mistral mit den Sollwerten aus `testdateien/` (Schweizer Rechnung als PNG und PDF,
  Sammel-PDF; läuft überall mit `.env`) und zusätzlich mit Fotos und 9-Seiten-PDF aus `tmp/`, wo vorhanden:
  `npx playwright test e2e/invoice-scan-real.spec.ts --project=ai-soft`. Nach Änderungen an Prompts oder
  `mergePdfPages` mit `--repeat-each=3` laufen lassen, ein einzelner grüner Lauf beweist bei Mistral wenig.
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

## Code Style
- German UI text and AI schema descriptions
- antfu ESLint (no semicolons, single quotes, if-newline rule)
- All source TypeScript; eslint.config.js stays .js (ESLint compat)

## Gotchas
- Fedora: `podman-compose` statt `docker-compose` verwenden
- Node `--env-file` überschreibt bereits exportierte Shell-Variablen **nicht**. Ein in der Shell gesetzter
  `MISTRAL_API_KEY` würde `npm run dev:proxy` übersteuern (war bis 2026-09-06 in `~/.bashrc` mit ungültigem Key,
  entfernt). Playwright gibt den `.env`-Key deshalb explizit per `env` mit.
- Der Proxy läuft mit Node-nativem Type-Stripping: relative Imports **mit `.ts`-Endung** (`./app.ts`), kein Build.
- **Kein Browser-BYOK mehr** (seit 06.09.2026): Der Client kennt keinen Mistral-Key und kein Modell, alles läuft über den Proxy. `VITE_AI_PROXY_URL` ist Pflicht.
- `pkill -f "node.ts"` killt die eigene Shell, wenn der Suchstring im Befehl steht → `pgrep -f "^node .*ai-proxy/src/node\.ts"`.

## InstantDB Gotchas
- Entity-IDs müssen UUIDs sein — `id()` verwenden, Hashes als separates Feld speichern
- `devtool: false` setzen — DevTools-Toggle blockiert UI-Klicks in Tests
- OCR-Cache: `tx.ocrcache[id()].update({ hash, markdown, ... })` statt `tx.ocrcache[hash].update(...)`

## Unit-Tests (Vitest)
- `src/**/*.test.ts`, Konfig `vitest.config.ts`. Proxy-Tests im Repo ai-proxy: `createApp(deps)` nimmt alles per DI
  (fetch, Store, verifyToken) → Proxy-Logik ohne Netz testbar. Stripe-Webhooks mit `generateTestHeaderString` signiert.
- Integrationstests im Repo ai-proxy (`src/stores/instant.test.ts`, `src/auth/instant.test.ts`) laufen gegen den lokalen InstantDB-Server
  und werden übersprungen, wenn er nicht läuft. Test-Token: `db.auth.createToken(email)` (Admin-SDK 0.22).

## Bank und Zahlungseingänge: PostFinance

Geschäftskonto ist PostFinance. Auswahl, Marktvergleich und die technische Prüfung stehen in
`../business/geschaeftskonten-vergleich.md`, die Feldbelegung von camt.054 dort im Abschnitt «camt.054: Felder für den
eigenen Zahlungsabgleich». Bankdokument als Kopie in `../business/sgkb-cash-management-handbuch.pdf`.

- **Zahlungsabgleich ohne AbaNinja**: Die Jahresrechnungen für Betriebe tragen eine QR- oder SCOR-Referenz aus
  `invoiceReference` (ai-proxy `src/invoice.ts`). Dieselbe Referenz steht im camt.054 unter
  `RmtInf/Strd/CdtrRefInf/Ref` und ist der Schlüssel für `markInvoicePaid`. AbaNinja Basic (CHF 21/Mt.) wird dafür
  nicht gebraucht.
- **camt.054 einlesen**: Parser in ai-proxy `src/camt.ts` (`parseCamt054`, fast-xml-parser, reine Funktion),
  Zuordnung in `src/services/billing-job.ts` (`matchCredits`), Aufruf `billing.mjs camt <datei.xml> [--dry-run]`
  (README «8.»). Iteriert wird über `NtryDtls/TxDtls`, nicht über `Ntry`: ein Tag mit mehreren Zahlungen kommt als
  eine Sammelbuchung. Das Buchungsdatum steht als `Ntry/BookgDt/Dt` am Eintrag, nicht an der Zahlung.
  `markInvoicePaid` bucht nur den vollen Betrag und lehnt eine schon verbuchte `AcctSvcrRef` ab; der Endpunkt
  `/billing/paid` antwortet darauf mit 409, auf eine unbekannte Referenz mit 404.
- **Strasse und Hausnummer getrennt im QR-Zahlteil**: `splitStreet` (ai-proxy `src/invoice.ts`) zerlegt die eine
  Adresszeile aus Bestellung und Absender in `address` und `buildingNumber` (`qrBillData` in `invoice-pdf.ts`).
  Ohne Trennung erfasst die Post Einzahlungen am Schalter kostenpflichtig nach. Postfachzeilen bleiben ganz, die
  Zahl dahinter ist die Fachnummer.
- **Eine QR-Einzahlung hat keinen `Dbtr`**: Der Zahler steht dann nur unter `RltdPties/UltmtDbtr`, der Parser fällt
  darauf zurück. `AddtlRmtInf` kommt mehrfach, PostFinance stellt eigene Statusmeldungen (`?REJECT?0`, `?ERROR?000`)
  vor die Mitteilung des Zahlers; Zeilen mit `?` fallen weg. Gebühren (`Chrgs`) mindern den Betrag nicht.
- **Testen ohne Konto**: Die PostFinance-Testplattform (isotest.postfinance.ch, Benutzer `gst`, Passwort im
  Passwortmanager, Mails an `info@strainovic-it.ch`, lesbar mit `mailbox strainovic`) simuliert die ganze Kette.
  Eingerichtet sind Produktangebot 2 (ISO 2019, camt V08), Konto `CH2909000000250094239` in CHF mit festem Saldo und
  das virtuelle Konto QRR `CH7730000001250094239`; Avisierung: camt.054 getrennt je virtuellem Konto, Sammelbuchung,
  SCOR eingeschlossen. Ablauf: QR-Rechnung mit `renderInvoicePdf` auf die QR-IBAN erzeugen, unter «QR-Rechnung →
  QR-Rechnung verarbeiten» hochladen, **Kredit erzeugen** (Kreditorverarbeitung = Zahlungseingang), ZIP
  herunterladen. Neue Parser-Arbeit wird dort belegt, nicht am Produktivkonto.
- **Fixtures** (`ai-proxy/src/fixtures/`): `camt054-testplattform-qrr.xml` ist die Antwort der Testplattform auf eine
  echte Wartungsheft-Rechnung und die Messlatte. `camt054-postfinance-muster.xml` ist die Musterdatei von PostFinance
  (Gutschrift ohne Referenz). `camt054-qrr.xml` ist nachgebaut und deckt ab, was die Testplattform pro Lauf nicht
  liefert: mehrere `TxDtls` in einer Sammelbuchung, SCOR-Referenz und eine Belastung.
- **EBICS erst bei Menge**: Zu Beginn reicht der manuelle camt.054-Download im E-Banking. PostFinance spricht EBICS
  3.0 und 2.5; mit 2.5 läuft `node-ebics/node-ebics-client`, was zum Node-Stack passt.

## Themen in Skills (`.claude/skills/`, laden bei Bedarf)
- `mistral-limits` — Vision-Limits, OCR-Limits, API-Tiers & Rate-Limits, Datenschutz (Mistral).
- `app-hilfe` — Diktieren, Rückmeldungen aus der App, Hilfe und Auffindbarkeit, Werbefilme, Abläufe prüfen.
- `e2e-test` — E2E-Tests ausführen/filtern/debuggen **und** Suite-Konventionen (Architektur, Offline, Test-ID-Schema, PrimeVue-Selektoren).
- `instantdb-start` — lokalen InstantDB-Server starten/stoppen/prüfen **und** Betrieb/Produktion (Infomaniak), Google-Login, Magic-Code-Auth, RxDB-Unterschied.
- `werbefilm` — Werbefilme neu aufnehmen, montieren und ausliefern.
