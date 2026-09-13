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
npm run dev    # Prüft automatisch ob InstantDB läuft
```

Die App läuft auf http://localhost:5173.

### AI konfigurieren

1. Mistral-API-Key unter console.mistral.ai erstellen
2. App öffnen -> Einstellungen
3. API-Key eingeben (Modell optional, Standard: mistral-small-latest)

## Befehle

```bash
npm run dev          # Vite Dev Server + InstantDB Auto-Start
npm run dev:vite     # Nur Vite (InstantDB muss manuell laufen)
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
npm run build          # liest .env.production (Modus selfhosted, App-ID, API-, WS- und Proxy-URL), schreibt dist/
rsync -az --delete dist/ debian@195.15.207.47:/opt/auto-service/deploy/dist/
```

Caddy liefert die Dateien direkt aus dem Mount, kein Neustart nötig.

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

1. Produkte mit monatlichen Preisen in CHF anlegen (Basic, Pro) → Price-IDs in `STRIPE_PRICE_BASIC` / `STRIPE_PRICE_PRO`.
2. Webhook auf `https://ai.example.ch/stripe/webhook` mit Events `checkout.session.completed`,
   `customer.subscription.updated`, `customer.subscription.deleted` → Secret in `STRIPE_WEBHOOK_SECRET`.
3. Customer Portal im Stripe-Dashboard aktivieren (Kündigung, Zahlungsmittel).

Ohne Stripe-Konfiguration antworten `/billing/*` mit 501, alle Nutzer bleiben im Free-Plan.

### 5. Backup

`/opt/backup/backup.sh` läuft täglich um 03:00 per Cron (Nutzer `debian`): `pg_dump -Fc` der Instant-Datenbank und ein
Tar des MinIO-Volumens nach `/opt/backups`, 14 Tage Aufbewahrung, Log in `/opt/backups/backup.log`. Dasselbe Skript
kürzt das Caddy-Zugriffslog der PWA auf 30 Tage (Datenschutzerklärung), weil Caddy nur nach Grösse rotiert.

Wiederherstellung (Stack gestoppt bis auf Postgres):

```bash
cd /opt/instant
C="docker compose -f docker-compose.with-caddy.yml -f docker-compose.override.yml --env-file .env"
$C stop server www caddy
$C exec -T postgres dropdb -U instant instant && $C exec -T postgres createdb -U instant instant
$C exec -T postgres pg_restore -U instant -d instant < /opt/backups/instant-YYYYMMDD.dump
docker run --rm -v instant_minio_data:/data -v /opt/backups:/b:ro alpine sh -c "cd /data && tar xzf /b/minio-YYYYMMDD.tgz"
$C up -d
```

Vor riskanten Änderungen (InstantDB-Upgrade, grössere Migrationen) zusätzlich ein Snapshot der ganzen Instanz vom Laptop aus:
`openstack --os-cloud PCP-CTPZLR8-dc3-a server image create --name wartungsheft-<grund>-<datum> wartungsheft`.

### 6. Health-Checks und Zahlen für die Validierung

- InstantDB: `curl -fsS https://api.wartungsheft.ch/health/system` → `{"wal":"ok"}`
- AI-Proxy: `curl -fsS https://ai.wartungsheft.ch/health` → `{"ok":true}`
- Besucher der Landing Pages: Caddy-Zugriffslog im Volume `instant_caddy_data` unter `/data/access-app.log` (JSON),
  Klicks (`events`) und Einträge (`leads`) über die Admin-API mit dem Token aus `deploy/.env`:

```bash
set -a; . /opt/auto-service/deploy/.env; set +a
curl -s -X POST https://api.wartungsheft.ch/admin/query -H "Content-Type: application/json" \
  -H "App-Id: $INSTANT_APP_ID" -H "Authorization: Bearer $INSTANT_ADMIN_TOKEN" -d '{"query":{"leads":{},"events":{}}}'
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

Privat
