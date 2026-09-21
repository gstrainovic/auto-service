# Wartungsheft (Repo auto-service)

Offline-fähige PWA zur Verwaltung von Fahrzeugen, Wartungen und Werkstattrechnungen — mit KI-gestütztem Dokumenten-Scanner und Chat-Assistent.

## Features

- **Fahrzeugverwaltung** — Fahrzeuge anlegen, bearbeiten, löschen mit Kilometerstand-Tracking
- **KI-Dokumenten-Scanner** — Rechnungen, Kaufverträge, Fahrzeugscheine und Service-Hefte per Foto analysieren
- **Wartungs-Dashboard** — Übersicht über fällige, überfällige und erledigte Wartungen pro Fahrzeug
- **KI-Chat-Assistent** — Floating Chat mit Tool-Calling: Fahrzeuge verwalten, Dokumente scannen, Wartungsstatus abfragen
- **KI durch Mistral AI** — OCR + Chat-Modell aus Frankreich (EU), mit eigenem API-Key
- **Echtzeit-Sync** — InstantDB als Backend mit WebSocket-Sync
- **Offline-First** — Daten in IndexedDB, App funktioniert ohne Server (CRDT-Sync bei Reconnect)
- **PWA** — Installierbar auf Smartphone und Desktop

## Tech Stack

| Bereich | Technologie |
|---------|-------------|
| Frontend | Vue 3, PrimeVue, Pinia, Vue Router |
| AI-Proxy | Hono auf Node 24, eigenes Repo [ai-proxy](https://github.com/gstrainovic/ai-proxy), Nutzungszähler + Plan-Limits, Stripe |
| Datenbank | InstantDB (self-hosted, PostgreSQL + WebSocket) |
| AI | Vercel AI SDK v6, Zod |
| Build | Vite, TypeScript, PWA (Workbox) |
| Tests | Playwright (E2E, online + offline) |
| Linting | ESLint (antfu config) |

## Schnellstart

### 1. InstantDB Server starten

```bash
# Erster Start: Klone das InstantDB-Repo
git clone https://github.com/instantdb/instant ~/instant

# Server starten (braucht Docker/Podman)
cd ~/instant/server && podman-compose -f docker-compose-dev.yml up -d
```

### 2. App starten

```bash
npm install
npm run dev    # Startet InstantDB und AI-Proxy mit, falls sie nicht laufen (lokaler Modus)
```

Die App läuft auf http://localhost:6060.

### AI konfigurieren

1. Mistral-API-Key unter console.mistral.ai erstellen
2. App öffnen -> Einstellungen
3. API-Key eingeben (Modell optional, Standard: mistral-small-latest)

## Befehle

```bash
npm run dev          # Vite + InstantDB + AI-Proxy, lokaler Modus mit Auth-Bypass
npm run dev:vite     # Nur Vite (InstantDB und Proxy müssen laufen, Modus per VITE_INSTANTDB_MODE)
npm run build        # Produktions-Build (vue-tsc + Vite)
npm run lint         # ESLint prüfen
npm run lint:fix     # ESLint auto-fix
npm run test:e2e     # Playwright E2E-Tests (online + offline)
npm run test:e2e:ui  # Playwright im UI-Modus
```

## Projektstruktur

```
src/
  pages/          DashboardPage, VehiclesPage, VehicleDetailPage, SettingsPage
  components/     ChatDrawer, VehicleCard, VehicleForm
  services/       ai.ts (Mistral OCR-Pipeline + Modell), chat.ts (Tool-Calling), maintenance-schedule.ts
  stores/         Pinia: vehicles, invoices, maintenances, settings
  lib/            instantdb.ts (DB-Client)
  composables/    useImageResize, useImageUpload, useFormValidation
e2e/              Playwright Tests + Fixtures
scripts/          dev.sh, Test-Hilfsskripte
```

## InstantDB (Self-Hosted)

### Architektur

```
Browser (PWA)
  |-- IndexedDB (Offline-Cache, CRDT)
  '-- WebSocket ----> InstantDB Server ----> PostgreSQL
                         |
                         '--> Resend (Magic Code E-Mails, Produktion)
```

### Lokale Services

| Service | Port | Beschreibung |
|---------|------|-------------|
| InstantDB Server | 8888 | HTTP API + WebSocket |
| PostgreSQL | 8890 (->5432) | PostgreSQL 16, WAL logical replication, pg_hint_plan |

### Server-Befehle

```bash
# Starten
cd ~/instant/server && podman-compose -f docker-compose-dev.yml up -d

# Stoppen
cd ~/instant/server && podman-compose -f docker-compose-dev.yml down

# Logs
cd ~/instant/server && podman-compose -f docker-compose-dev.yml logs -f server

# PostgreSQL Debug
podman exec server_postgres_1 psql -U instant -d instant -c "SELECT * FROM apps;"
```

### Konfiguration

- **App-ID:** `cd7e6912-773b-4ee1-be18-4d95c3b20e9f` (in `src/lib/instantdb.ts`)
- **HTTP API:** Via Vite-Proxy `/instant-api` -> `localhost:8888`
- **WebSocket:** `ws://localhost:8888/runtime/session`
- **Server-Config:** `~/instant/server/resources/config/override.edn`

## Produktion (Infomaniak Public Cloud, wartungsheft.ch)

Alles läuft auf einer Instanz in der Infomaniak Public Cloud (OpenStack, Schweiz; Debian 13, 2 vCPU, 4 GB RAM,
Instanz `wartungsheft`, Domain und Server im selben Infomaniak-Konto, DNS per API). Drei Bausteine:

| Baustein | Woher | Domains |
|----------|-------|---------|
| InstantDB (Backend, Dashboard, PostgreSQL, MinIO, Caddy) in `/opt/instant` | Offizieller VPS-Guide: https://www.instantdb.com/docs/self-hosting/vps plus `docker-compose.override.yml` | `api.`, `dash.`, `files.` |
| PWA (statisches `dist/`) + AI-Proxy (Repo `ai-proxy`, daneben ausgecheckt) in `/opt/auto-service` | Dieses Repo, `deploy/` | `wartungsheft.ch` (`www.` und `app.` leiten um), `ai.` |
| Mistral | Scale-Tier (kein Training), Key liegt nur im AI-Proxy | – |

Es gibt nur **einen Caddy**, den des InstantDB-Stacks: er importiert `deploy/Caddyfile` (`import /etc/caddy/sites/*.caddy`)
und bekommt `deploy/dist` als `/srv/app` gemountet; der AI-Proxy hängt im Docker-Netz `instant_default`.

> InstantDB Cloud (instantdb.com) nimmt keine neuen Apps mehr an und wird am 31.08.2027 abgeschaltet.
> Produktion läuft deshalb ausschliesslich self-hosted.

### 1. InstantDB nach offiziellem Guide aufsetzen

Dem VPS-Guide folgen (`docker-compose.with-caddy.yml`, `.env` mit `BACKEND_DOMAIN`, `DASHBOARD_DOMAIN`,
`STORAGE_DOMAIN`, generierte Passwörter). Dazu `docker-compose.override.yml` mit `JAVA_OPTS=-Xmx2g -Xms2g`,
`restart: unless-stopped`, MinIO-Images von `quay.io/minio/*` (auf Docker Hub gibt es `minio/minio` und `minio/mc`
nicht mehr) und den Caddy-Mounts für `deploy/Caddyfile` und `deploy/dist`. Start und alle weiteren Befehle immer mit
beiden Compose-Dateien:

```bash
cd /opt/instant
docker compose -f docker-compose.with-caddy.yml -f docker-compose.override.yml --env-file .env up -d
```

Dann im Dashboard (`dash.`) als `INSTANT_SUPERUSER_EMAIL` anmelden (ohne E-Mail-Provider steht der Code im Server-Log:
`… logs server | grep postmark/send-disabled`), unter «Deployment Settings» Signups auf **Closed** und «Allow temporary
app creation» **aus**, App anlegen und notieren: **App-ID** (öffentlich, steht in `.env.production`) und
**Admin-Token** (nur in `deploy/.env`; alternativ aus der Datenbank: `select token from app_admin_tokens where app_id=…`).

Berechtigungen aus `instant.perms.ts` setzen: `instant-cli push perms` scheitert gegen die eigene Instanz
(«Record not found: instant-user»), deshalb als JSON im Dashboard unter «Permissions» einfügen:

```bash
node -e "import('./instant.perms.ts').then(m=>console.log(JSON.stringify(m.default,null,2)))" | wl-copy
```

### 2. PWA bauen

```bash
npm run deploy         # scripts/deploy.sh: build (liest .env.production), build:reminders, rsync dist/ und reminders.mjs, git pull auf der Instanz, Health-Checks
```

Caddy liefert die Dateien direkt aus dem Mount, kein Neustart nötig. Vorher committen und pushen, weil die Instanz den
Server-Checkout per `git pull` nachzieht (Compose-Datei, Caddyfile).

### 3. AI-Proxy starten

```bash
# auf der Instanz, Repos liegen unter /opt/auto-service und /opt/ai-proxy
cd /opt/auto-service && git pull
cd deploy
cp .env.example .env   # einmalig: Domains, MISTRAL_API_KEY, INSTANT_APP_ID, INSTANT_ADMIN_TOKEN, optional Stripe
docker compose --env-file .env up -d --build
curl -fsS https://ai.wartungsheft.ch/health   # {"ok":true}
```

Nach Änderungen an `deploy/Caddyfile` den Caddy des InstantDB-Stacks neu laden:
`cd /opt/instant && docker compose -f docker-compose.with-caddy.yml -f docker-compose.override.yml --env-file .env restart caddy`.

Der Proxy (Repo `ai-proxy`, Hono auf Node 24) hält den Mistral-Key, prüft das InstantDB-Refresh-Token des
Nutzers per Admin-SDK, reicht `/v1/chat/completions` und `/v1/ocr` durch, zählt Tokens und OCR-Seiten
pro Nutzer und Monat in InstantDB (`usage`) und setzt die Plan-Limits aus `@strainovic/ai-proxy/plans` durch.

### 4. Stripe (Abo-Zahlung, optional)

1. Produkte in CHF anlegen: `privat` 25 CHF im Jahr, `betrieb` 36 CHF pro Fahrzeug und Jahr (Menge = Fahrzeuge) → Price-IDs in `STRIPE_PRICE_PRIVAT` / `STRIPE_PRICE_BETRIEB`.
2. Webhook auf `https://ai.example.ch/stripe/webhook` mit Events `checkout.session.completed`,
   `customer.subscription.updated`, `customer.subscription.deleted` → Secret in `STRIPE_WEBHOOK_SECRET`.
3. Customer Portal im Stripe-Dashboard aktivieren (Kündigung, Zahlungsmittel).

Ohne Stripe-Konfiguration antworten `/billing/*` mit 501, alle Nutzer bleiben im Free-Plan. Die Upgrade-Buttons in den
Einstellungen erscheinen erst mit `VITE_BILLING_ENABLED=true` in `.env.production`; bis dahin steht dort die
Kontaktadresse für die Jahresrechnung (Businessplan Kapitel 4: erste Kunden zahlen per QR-Rechnung).

### 5. Backup

`/opt/backup/backup.sh` läuft täglich um 03:00 per Cron (`/etc/cron.d/wartungsheft-backup`, Nutzer `debian`): `pg_dump -Fc` der Instant-Datenbank und ein
Tar des MinIO-Volumens nach `/opt/backups`, 14 Tage Aufbewahrung, Log in `/opt/backups/backup.log`. Dasselbe Skript
kürzt das Caddy-Zugriffslog der PWA auf 30 Tage (Datenschutzerklärung), weil Caddy nur nach Grösse rotiert.

Ausser Haus liegt eine Kopie beider Dateien im Swift-Container `wartungsheft-backups` (Infomaniak, Region dc3-a),
30 Tage per `X-Delete-After`. Das Skript lädt über eine TempURL hoch: auf dem Server liegt in `/opt/backup/swift.env`
(Modus 600) nur der TempURL-Schlüssel dieses Containers, kein OpenStack-Credential; mit ihm lässt sich kein anderer
Container und keine Instanz ansprechen. Scheitert der Upload, endet das Skript mit Exit-Code ungleich 0 und schreibt
`Swift-Upload: failed` ins Log. Vom Laptop aus (Cloud `PCP-CTPZLR8-backup`, Credential `claude-backup` mit allen
Rollen des Benutzers; das Credential `PCP-CTPZLR8-dc3-a` hat nur `member` und bekommt von Swift 403):

```bash
openstack --os-cloud PCP-CTPZLR8-backup object list wartungsheft-backups --long
openstack --os-cloud PCP-CTPZLR8-backup object save wartungsheft-backups instant-YYYYMMDD.dump
```

Neuer TempURL-Schlüssel: `openstack --os-cloud PCP-CTPZLR8-backup container set --property Temp-URL-Key=<neu>
wartungsheft-backups`, dann `SWIFT_TEMPURL_KEY` in `/opt/backup/swift.env` ersetzen.

Wiederherstellung (Stack gestoppt bis auf Postgres):

```bash
cd /opt/instant
C="docker compose -f docker-compose.with-caddy.yml -f docker-compose.override.yml --env-file .env"
$C stop server www caddy
$C exec -T postgres dropdb -U instant instant && $C exec -T postgres createdb -U instant instant
$C exec -T postgres pg_restore -U instant -d instant < /opt/backups/instant-YYYYMMDD.dump
# Pflicht: abgeleitete Aggregator-Daten leeren und den Replikations-Slot neu anlegen lassen,
# sonst stirbt der Server beim Start
$C exec -T postgres psql -U instant -d instant -c "truncate attr_sketches, triples_size_aggregate, wal_aggregator_status, wal_logs"
$C exec -T postgres psql -U instant -d instant -tAc "select pg_drop_replication_slot(slot_name) from pg_replication_slots where slot_name = 'aggregator' and not active"
docker run --rm -v instant_minio_data:/data -v /opt/backups:/b:ro alpine sh -c "cd /data && tar xzf /b/minio-YYYYMMDD.tgz"
$C up -d
```

Warum die beiden Zeilen nötig sind (alles abgeleitete Daten, die im Betrieb neu entstehen):

- ohne `truncate attr_sketches` stirbt der Start an
  `duplicate key value violates unique constraint "attr_sketches_app_id_attr_id_key"`,
- ohne `truncate wal_aggregator_status` an `duplicate key value violates unique constraint "wal_aggregator_status_pkey"`,
- ohne den gelöschten Slot meldet der Aggregator
  `confirmed-flush-lsn is older than start-lsn, cannot start stream from start-lsn` und läuft nicht mit.

Der Server braucht nach `up -d` etwa eine Minute, bis Port 8888 offen ist; bis dahin antwortet Caddy mit 502.
Prüfen: `curl -fsS https://api.wartungsheft.ch/health/system` → `{"wal":"ok"}` und
`select slot_name, active from pg_replication_slots` → `aggregator` aktiv.

Vor riskanten Änderungen (InstantDB-Upgrade, grössere Migrationen) zusätzlich ein Snapshot der ganzen Instanz vom Laptop aus:
`openstack --os-cloud PCP-CTPZLR8-dc3-a server image create --name wartungsheft-<grund>-<datum> wartungsheft`.

Die Nutzdaten stecken alle im Postgres-Dump, auch die Belegbilder (sie liegen als base64 in der Entität `invoices`).
Das MinIO-Volume enthält nur den leeren Bucket `instant-bucket` und die Metadaten des Storage — es wird trotzdem
gesichert, damit ein Restore ohne Neueinrichtung startet.

**Restore ohne Produktion üben** (Laptop, rootless Podman; braucht nur die beiden Dateien aus `/opt/backups`):

```bash
scp debian@<instanz>:/opt/backups/instant-YYYYMMDD.dump debian@<instanz>:/opt/backups/minio-YYYYMMDD.tgz /tmp/
podman run -d --name restore-pg -e POSTGRES_USER=instant -e POSTGRES_PASSWORD=restoretest \
  -e POSTGRES_DB=instant ghcr.io/instantdb/postgresql:postgresql-17-pg-hint-plan
until podman exec restore-pg pg_isready -U instant -q; do sleep 2; done
podman exec -i restore-pg pg_restore -U instant -d instant --clean --if-exists < /tmp/instant-YYYYMMDD.dump
# Probe: Zeilen pro App gegen die Produktion vergleichen
podman exec restore-pg psql -U instant -d instant -tAc "select app_id, count(*) from triples group by 1 order by 2 desc"
# MinIO-Volume prüfen: Bucket muss nach dem Entpacken da sein
podman volume create restore_minio
podman run --rm -v restore_minio:/data -v /tmp:/b:ro,Z alpine sh -c "cd /data && tar xzf /b/minio-YYYYMMDD.tgz"
podman run -d --name restore-minio -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin \
  -v restore_minio:/data quay.io/minio/minio:latest server /data
podman exec restore-minio mc alias set local http://127.0.0.1:9000 minioadmin minioadmin
podman exec restore-minio mc ls local   # instant-bucket
podman rm -f restore-pg restore-minio && podman volume rm restore_minio
```

`pg_restore` läuft ohne vorheriges `dropdb`, wenn `--clean --if-exists` gesetzt ist; ohne die Schalter muss die
Datenbank leer sein.

### 6. Health-Checks und Zahlen für die Validierung

- InstantDB: `curl -fsS https://api.wartungsheft.ch/health/system` → `{"wal":"ok"}`
- AI-Proxy: `curl -fsS https://ai.wartungsheft.ch/health` → `{"ok":true}`
- Automatisch alle 15 Minuten von aussen: GitHub-Actions-Workflow `.github/workflows/health.yml` prüft Website,
  AI-Proxy und InstantDB und mailt bei einem Ausfall über Resend an `info@wartungsheft.ch`. Nötig ist einmalig das
  Repository-Secret: `gh secret set RESEND_TOKEN --repo gstrainovic/auto-service` (Wert aus `/opt/instant/.env`).
  Ohne Secret läuft die Prüfung weiter, meldet aber nur im Lauf. GitHub schaltet geplante Läufe nach 60 Tagen ohne
  Aktivität im Repository ab; `workflow_dispatch` startet sie von Hand.
- Besucher der Landing Pages: Caddy-Zugriffslog im Volume `instant_caddy_data` unter `/data/access-app.log` (JSON),
  Klicks (`events`) über die Admin-API mit dem Token aus `deploy/.env`, Fragen landen im Postfach `info@wartungsheft.ch`:

```bash
set -a; . /opt/auto-service/deploy/.env; set +a
curl -s -X POST https://api.wartungsheft.ch/admin/query -H "Content-Type: application/json" \
  -H "App-Id: $INSTANT_APP_ID" -H "Authorization: Bearer $INSTANT_ADMIN_TOKEN" -d '{"query":{"events":{}}}'
```

- Nutzungswege in der App: Fahrzeuge, Rechnungen und Wartungen tragen ihre Herkunft `source` (`chat`, `formular`,
  `stapel`, `wartungsplan`, `serviceheft`, `dashboard`; `src/services/entry-source.ts`, ältere Einträge ohne Feld).
  Zählung pro Herkunft, ohne Belegbilder zu laden (`fields`):

```bash
set -a; . /opt/auto-service/deploy/.env; set +a
curl -s -X POST https://api.wartungsheft.ch/admin/query -H "Content-Type: application/json" \
  -H "App-Id: $INSTANT_APP_ID" -H "Authorization: Bearer $INSTANT_ADMIN_TOKEN" \
  -d '{"query":{"vehicles":{"$":{"fields":["source"]}},"invoices":{"$":{"fields":["source"]}},"maintenances":{"$":{"fields":["source"]}}}}' \
  | python3 -c 'import sys,json,collections;d=json.load(sys.stdin);[print(k,dict(collections.Counter(r.get("source","(leer)") for r in v))) for k,v in d.items()]'
```

### 7. E-Mail-Erinnerungen

Täglich um 07:00 UTC (`/etc/cron.d/wartungsheft-reminders`, Nutzer `debian`) läuft der Container `reminders` aus
`deploy/docker-compose.yml` (Profil `jobs`, Node 24 LTS, Skript `deploy/reminders.mjs` = Bündel von `scripts/reminders.ts`):

- liest `$users`, `vehicles`, `maintenances`, `settings` über die Admin-API,
- rechnet die Fälligkeit wie das Dashboard (`src/services/maintenance-schedule.ts`, nur `status === 'done'`),
- sendet pro Nutzer mit fälligen oder überfälligen Arbeiten eine Text-Mail über Resend
  (`Wartungsheft <erinnerung@wartungsheft.ch>`, Antwortadresse `info@wartungsheft.ch`, das Infomaniak-Postfach;
  Token `RESEND_TOKEN` in `deploy/.env`),
- merkt sich in `settings` (`lastReminderKey`, `lastReminderAt`), was gesendet wurde: unveränderte Erinnerungen
  frühestens nach 30 Tagen erneut, neue oder andere Arbeiten sofort,
- meldet neue Anmeldungen gebündelt in einer Mail an `info@wartungsheft.ch` (`SIGNUP_NOTICE_TO`,
  `src/services/signup-notice.ts`); `$users` hat kein Erstelldatum, gemeldet ist, wer `settings.signupNoticeAt` trägt.
  Mit `--only` entfällt die Meldung.

Abschalten pro Nutzer in den Einstellungen («Erinnerungen»), Feld `settings.emailReminders = false`.
Log: `/opt/auto-service/deploy/reminders.log`. Manuell:

```bash
cd /opt/auto-service/deploy
docker compose --env-file .env --profile jobs run --rm reminders node /app/reminders.mjs --dry-run   # zeigt Mails, sendet nichts
docker compose --env-file .env --profile jobs run --rm reminders node /app/reminders.mjs --only=<email>
```

### 8. Jahresabo auf Rechnung (Betriebe)

Betriebe bestellen in den Einstellungen («Jahresabo für Betrieb bestellen») mit Rechnungsadresse und Fahrzeugzahl.
Der AI-Proxy legt das Abo an (Entität `subscriptions`, `billing: 'invoice'`), erzeugt die QR-Rechnung (pdfkit +
swissqrbill, ohne MWST) und schickt sie über Resend an die Rechnungs-E-Mail, `info@wartungsheft.ch` in Bcc. Zugang
sofort, zahlbar in 30 Tagen; das bezahlte Jahr beginnt nach der Testzeit. Kündigen in den Einstellungen bis zum
Ablauf ohne Frist; eine offene Rechnung für ein noch nicht begonnenes Jahr wird dabei storniert. Voraussetzung:
`INVOICE_*`, `RESEND_TOKEN` und `AI_PROXY_INTERNAL_TOKEN` in `deploy/.env` (Vorlage `.env.example`).

Täglich läuft der Container `billing` (Profil `jobs`, Skript `deploy/billing.mjs` = Bündel von `scripts/billing.ts`):
30 Tage vor Ablauf zählt er die aktiven Fahrzeuge und lässt den Proxy die Verlängerungsrechnung schicken
(`/billing/renew`), danach listet er offene Rechnungen, überfällige markiert. Zahlungseingänge kommen als camt.054
aus dem E-Banking (PostFinance, Detailavis der Gutschriften) oder einzeln über die Referenz:

```bash
cd /opt/auto-service/deploy
C="docker compose --env-file .env --profile jobs run --rm billing node /app/billing.mjs"
$C open                                  # offene Rechnungen
$C camt /app/camt054.xml --dry-run       # camt.054 lesen, Zuordnung zeigen, nichts buchen
$C camt /app/camt054.xml                 # passende Zahlungen buchen, Rest mit «PRÜFEN» melden
$C paid RF31WH20260919DSKURD 2026-10-02  # Zahlung von Hand eintragen (Referenz oder Rechnungsnummer)
$C renew --dry-run                       # zeigt fällige Verlängerungen, verschickt nichts
```

`camt` bucht nur, was eindeutig passt: Gutschrift mit bekannter Referenz, Betrag gleich dem Rechnungsbetrag,
Buchung noch nicht verbucht (`AcctSvcrRef`). Teilzahlung, falscher Betrag, unbekannte oder fehlende Referenz
erscheinen als `PRÜFEN` und bleiben offen. Der Parser liegt im AI-Proxy (`src/camt.ts`), die Zuordnung in
`src/services/billing-job.ts` (`matchCredits`).

Cron (`/etc/cron.d/wartungsheft-billing`, Nutzer `debian`), Log `/opt/auto-service/deploy/billing.log`:

```
15 7 * * * debian cd /opt/auto-service/deploy && docker compose --env-file .env --profile jobs run --rm billing >> billing.log 2>&1
```

## Authentifizierung (Magic Codes via Resend)

InstantDB bietet passwordless Auth via Magic Codes (6-stelliger Code per E-Mail). Self-hosted InstantDB kennt dafür
nur Postmark, SendGrid oder Resend, kein SMTP. Produktion nutzt **Resend** (Free: 3'000 Mails/Monat, 100/Tag; Region
Irland eu-west-1), Absender `login@wartungsheft.ch`.

### Resend einrichten

1. Konto auf resend.com, API-Key mit «Sending access» (mehr braucht der Server nicht).
2. Domain `wartungsheft.ch` im Resend-Dashboard anlegen (Region Ireland, Tracking aus, «Enable Receiving» aus, damit
   MX und Postfach bei Infomaniak bleiben). Die CNAMEs `rsend` und `send` per Infomaniak-DNS-API setzen; den DKIM-Eintrag
   `resend._domainkey` im Infomaniak-Manager als Typ **DKIM** anlegen (per API als TXT wird er angenommen, aber nicht
   ausgeliefert).
3. In `/opt/instant/.env`: `RESEND_TOKEN=…`, `INSTANT_*_EMAIL_SENDER_EMAIL=login@wartungsheft.ch`, dann
   `… up -d server`. Ohne Token stehen die Codes im Server-Log (`… logs server | grep postmark/send-disabled`).
4. Lokal (`~/instant/server/resources/config/override.edn`) bleibt ohne Token, Codes im Log.

### Magic Code Flow

```
User gibt E-Mail ein
  -> db.auth.sendMagicCode({ email })
  -> InstantDB Server sendet 6-stelligen Code via Resend
  -> User gibt Code ein
  -> db.auth.signInWithMagicCode({ email, code })
  -> Session aktiv (Token in localStorage)
```

- **Code-TTL:** 24 Stunden
- **Einmal-Code:** Wird nach Verifizierung geloescht
- **Auto-Register:** Neuer User wird beim ersten Login automatisch angelegt

### Spaetere Auth-Erweiterungen

Magic Codes sind der Startpunkt. Spaeter erweiterbar um:
- Google OAuth, Apple Sign-In, GitHub OAuth (in InstantDB eingebaut)
- Passkeys/WebAuthn (via Custom Auth + Backend)
- Bei Wechsel des Mail-Dienstes nur `/opt/instant/.env` und die Datenschutzerklärung anpassen

## KI-Anbieter: Mistral

| Aufgabe | Modell | Preis (Stand 2026-09-05) |
|---------|--------|--------------------------|
| OCR (Rechnungen, PDFs) | mistral-ocr-latest | $4 pro 1.000 Seiten |
| Chat, Tool-Calling, Parsing | mistral-small-latest | $0.15/M Input, $0.60/M Output |

Ein Rechnungsscan kostet damit rund einen halben Cent. Der API-Key wird in der App
unter Einstellungen hinterlegt. `.env` wird nur fuer E2E-Tests benoetigt.

### Datenschutz

| Tier | Trainiert mit Daten? | Standort |
|------|---------------------|----------|
| Mistral Experiment (Free) | Ja (Opt-out moeglich) | Frankreich (EU) |
| Mistral Scale (Paid) | Nein | Frankreich (EU) |

Fuer produktive Nutzung ist der Scale-Tier vorgesehen: reine Nutzungsabrechnung, keine Grundgebuehr.

## E2E-Tests

Tests laufen automatisch doppelt: online + offline (Netzwerk-Blocking simuliert Offline-Modus).

```bash
npm run test:e2e                        # Alle (128 = 64x2)
npm run test:e2e -- --project=online    # Nur online
npm run test:e2e -- --project=offline   # Nur offline
```

`.env` mit `VITE_AI_API_KEY` (Mistral) wird fuer E2E benoetigt.

## Lizenz

Wartungsheft ist freie Software unter der [GNU Affero General Public License v3.0](./LICENSE) (AGPL-3.0-only). Du darfst es nutzen, verändern und weitergeben. Wer eine veränderte Version betreibt und anderen über ein Netzwerk zugänglich macht, muss den Quellcode dieser Version offenlegen.

Selbst hosten geht (Abschnitt «Produktion»), das Abo unter https://wartungsheft.ch ist der bequeme Weg: KI-Kontingent, Erinnerungen, Backups und Updates inklusive.

Für Unternehmen, die AGPL nicht einsetzen können, bietet Strainovic IT Wartungsheft auf Anfrage unter einer kommerziellen Lizenz an. Beiträge von Dritten unterliegen dem [Contributor License Agreement](./CLA.md), das diese Doppellizenzierung ermöglicht.

Copyright (C) 2026 Goran Strainovic, Strainovic IT
