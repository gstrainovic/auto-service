# Auto-Service PWA

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
                         '--> Postmark (Magic Code E-Mails)
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

## Produktion auf Hetzner (InstantDB + PWA + AI-Proxy)

Alles läuft auf einer VM (2 vCPU, 4 GB RAM reichen für den Start). Drei Bausteine:

| Baustein | Woher | Domains |
|----------|-------|---------|
| InstantDB (Backend, Dashboard, PostgreSQL, MinIO, Caddy) | Offizieller VPS-Guide: https://www.instantdb.com/docs/self-hosting/vps | `api.`, `dash.`, `files.` |
| PWA (statisches `dist/`) + AI-Proxy (Repo `ai-proxy`, daneben ausgecheckt) | Dieses Repo, `deploy/docker-compose.yml` | `app.`, `ai.` |
| Mistral | Scale-Tier (kein Training), Key liegt nur im AI-Proxy | – |

> InstantDB Cloud (instantdb.com) nimmt keine neuen Apps mehr an und wird am 31.08.2027 abgeschaltet.
> Produktion läuft deshalb ausschliesslich self-hosted.

### 1. InstantDB nach offiziellem Guide aufsetzen

Dem VPS-Guide folgen (`docker-compose.with-caddy.yml`, `.env` mit `BACKEND_DOMAIN`, `DASHBOARD_DOMAIN`,
`STORAGE_DOMAIN`). Danach im Dashboard eine App anlegen und notieren: **App-ID** und **Admin-Token**.
Wichtig aus dem Guide: `JAVA_OPTS=-Xmx2g -Xms2g`, `INSTANT_SUPERUSER_EMAIL` setzen, Dashboard-Signups auf
"Closed", "Allow temporary app creation" aus, E-Mail-Provider (Postmark/SendGrid/Resend) konfigurieren.

Berechtigungen aus `instant.perms.ts` auf die Instanz pushen:

```bash
INSTANT_CLI_API_URI=https://api.example.ch INSTANT_CLI_DASH_URI=https://dash.example.ch npx instant-cli@latest login
INSTANT_CLI_API_URI=https://api.example.ch INSTANT_CLI_DASH_URI=https://dash.example.ch npx instant-cli@latest push perms
```

### 2. PWA bauen

```bash
cp .env.example .env   # VITE_INSTANTDB_MODE=selfhosted, VITE_INSTANT_*, VITE_AI_PROXY_URL setzen
npm run build          # dist/
rsync -av --delete dist/ user@vm:/opt/auto-service/deploy/dist/
```

### 3. AI-Proxy + Caddy starten

```bash
# auf der VM, Repo liegt unter /opt/auto-service
cd /opt/auto-service/deploy
cp .env.example .env   # Domains, MISTRAL_API_KEY, INSTANT_APP_ID, INSTANT_ADMIN_TOKEN, optional Stripe
docker compose --env-file .env up -d --build
curl -fsS https://ai.example.ch/health   # {"ok":true}
```

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

```bash
# InstantDB-Postgres (Container-Name aus dem offiziellen Compose)
docker exec <postgres-container> pg_dump -U instant instant | gzip > backup_$(date +%Y%m%d).sql.gz
```

Täglich per Cron auf eine Hetzner Storage Box kopieren, Restore einmal durchspielen.

### 6. Health-Checks

- InstantDB: `curl -fsS https://api.example.ch/health/system` → `{"wal":"ok"}`
- AI-Proxy: `curl -fsS https://ai.example.ch/health` → `{"ok":true}`

## Authentifizierung (Magic Codes via Postmark)

InstantDB bietet passwordless Auth via Magic Codes (6-stelliger Code per E-Mail).
Self-hosted InstantDB nutzt **Postmark** fuer den E-Mail-Versand (kein direktes SMTP).

### Postmark einrichten

1. Account erstellen: https://postmarkapp.com (Free Tier: 100 Mails/Monat)
2. Server API Token generieren (Dashboard -> Server -> API Tokens)
3. Absender-Adresse verifizieren (z.B. `noreply@deine-domain.de`)
4. Token in die **InstantDB Server-Config** eintragen (NICHT in auto-service/.env!):

```edn
;; ~/instant/server/resources/config/override.edn
{:aead-keyset {...}
 :postmark-token {:plain "dein-postmark-server-api-token"}}
```

5. InstantDB-Server neu starten

### Magic Code Flow

```
User gibt E-Mail ein
  -> db.auth.sendMagicCode({ email })
  -> InstantDB Server sendet 6-stelligen Code via Postmark
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
- Bei Wechsel zu InstantDB Cloud entfaellt die Postmark-Konfiguration

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
