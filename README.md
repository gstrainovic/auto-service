# Auto-Service PWA

Offline-fähige PWA zur Verwaltung von Fahrzeugen, Wartungen und Werkstattrechnungen — mit KI-gestütztem Dokumenten-Scanner und Chat-Assistent.

## Features

- **Fahrzeugverwaltung** — Fahrzeuge anlegen, bearbeiten, löschen mit Kilometerstand-Tracking
- **KI-Dokumenten-Scanner** — Rechnungen, Kaufverträge, Fahrzeugscheine und Service-Hefte per Foto analysieren
- **Wartungs-Dashboard** — Übersicht über fällige, überfällige und erledigte Wartungen pro Fahrzeug
- **KI-Chat-Assistent** — Floating Chat mit Tool-Calling: Fahrzeuge verwalten, Dokumente scannen, Wartungsstatus abfragen
- **Multi-Provider AI** — Mistral, Anthropic Claude, OpenAI, Meta Llama (via OpenRouter)
- **Echtzeit-Sync** — InstantDB als Backend mit WebSocket-Sync
- **Offline-First** — Daten in IndexedDB, App funktioniert ohne Server (CRDT-Sync bei Reconnect)
- **PWA** — Installierbar auf Smartphone und Desktop

## Tech Stack

| Bereich | Technologie |
|---------|-------------|
| Frontend | Vue 3, Quasar, Pinia, Vue Router |
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

1. App öffnen -> Einstellungen
2. AI-Provider wählen (empfohlen: Mistral)
3. API-Key eingeben

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
  services/       ai.ts (Multi-Provider), chat.ts (Tool-Calling), maintenance-schedule.ts
  stores/         Pinia: vehicles, invoices, maintenances, settings
  lib/            instantdb.ts (DB-Client)
  composables/    useImageResize, useImageUpload, useFormValidation
e2e/              Playwright Tests + Fixtures
scripts/          compare-ai.ts
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

## InstantDB auf Hetzner deployen (Produktion)

### Systemvoraussetzungen

- **VPS:** Hetzner CX22+ (2 vCPU, 4 GB RAM) reicht fuer kleine Nutzerzahlen
- **OS:** Ubuntu 24.04 oder Fedora 41+
- **Docker** + Compose (oder Podman + podman-compose)
- **Domain** mit DNS A-Record -> Server-IP
- **Reverse Proxy:** Caddy (empfohlen, auto-HTTPS via Let's Encrypt)

### 1. Server vorbereiten

```bash
# Docker installieren (Ubuntu)
curl -fsSL https://get.docker.com | sh

# Oder Podman (Fedora)
sudo dnf install podman podman-compose

# InstantDB klonen
git clone https://github.com/instantdb/instant.git
cd instant/server
```

### 2. Config erstellen

```bash
# Bootstrap-Config generieren (erstellt override.edn mit Encryption-Keys)
make bootstrap-oss
```

Die generierte `resources/config/override.edn` enthaelt den Encryption-Key.
Postmark-Token fuer Auth hinzufuegen (siehe Authentifizierung weiter unten):

```edn
{:aead-keyset {:encrypted? false, :json "{...}"}
 :postmark-token {:plain "dein-postmark-server-api-token"}}
```

### 3. Server starten

```bash
# Mit Docker
docker compose -f docker-compose-dev.yml up -d

# Mit Podman
podman-compose -f docker-compose-dev.yml up -d
```

Server laeuft auf Port 8888 (HTTP + WebSocket).

### 4. Reverse Proxy (Caddy)

```bash
sudo apt install caddy   # Ubuntu
sudo dnf install caddy   # Fedora
```

`/etc/caddy/Caddyfile`:
```
deine-domain.de {
    reverse_proxy localhost:8888
}
```

```bash
sudo systemctl enable --now caddy
```

Caddy holt automatisch ein Let's Encrypt Zertifikat (HTTPS + WSS).

### 5. Frontend-Config anpassen

In `src/lib/instantdb.ts` die URIs fuer Produktion umstellen:

```typescript
const INSTANT_API_URI = 'https://deine-domain.de'
const INSTANT_WS_URI = 'wss://deine-domain.de/runtime/session'
```

### 6. Daten-Backup

```bash
# PostgreSQL Dump erstellen
docker exec <postgres-container> pg_dump -U instant instant > backup_$(date +%Y%m%d).sql

# Restore
cat backup.sql | docker exec -i <postgres-container> psql -U instant instant
```

### 7. App-ID fuer neue Instanz

Bei einer frischen InstantDB-Installation wird die App beim ersten Client-Connect
automatisch erstellt. App-ID auslesen:

```bash
docker exec <postgres-container> psql -U instant -d instant -c "SELECT id, title FROM apps;"
```

Die App-ID in `src/lib/instantdb.ts` eintragen.

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

## AI-Provider

| Provider | Modell | Vision | Tools | Kosten |
|----------|--------|--------|-------|--------|
| **Mistral** | mistral-small-latest | Ja | Ja | Free/Scale |
| Anthropic | Claude Sonnet | Ja | Ja | Bezahlt |
| OpenAI | GPT-4o Mini | Ja | Ja | Bezahlt |
| Meta Llama | Llama 4 Maverick (OpenRouter) | Ja | Ja | Free Tier |
| Ollama | qwen3-vl:2b (lokal) | Ja | Ja | Kostenlos |

Provider und API-Key werden in der App unter Einstellungen konfiguriert.
`.env` wird nur fuer E2E-Tests benoetigt.

### Datenschutz

| Provider | Trainiert mit Daten? | EU-konform? |
|----------|---------------------|-------------|
| Mistral Free (Experiment) | Ja (Opt-out moeglich) | Ja |
| OpenRouter + Gemini Free | Ja (Google) | Nein (Free Tier) |
| Meta Llama API | Nein | Eingeschraenkt (Vision in EU limitiert) |
| Anthropic API (bezahlt) | Nein | Ja |
| OpenAI API (bezahlt) | Nein | Ja |
| Ollama (lokal) | Nein (100% privat) | Ja |

## E2E-Tests

Tests laufen automatisch doppelt: online + offline (Netzwerk-Blocking simuliert Offline-Modus).

```bash
npm run test:e2e                        # Alle (128 = 64x2)
npm run test:e2e -- --project=online    # Nur online
npm run test:e2e -- --project=offline   # Nur offline
```

`.env` mit AI-Provider-Keys wird fuer E2E benoetigt.

## Lizenz

Privat
