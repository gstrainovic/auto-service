# Auto-Service

Offline-fähige PWA zur Verwaltung von Fahrzeugen, Wartungen und Werkstattrechnungen — mit KI-gestütztem Dokumenten-Scanner und Chat-Assistent.

## Features

- **Fahrzeugverwaltung** — Fahrzeuge anlegen, bearbeiten, löschen mit Kilometerstand-Tracking
- **KI-Dokumenten-Scanner** — Rechnungen, Kaufverträge, Fahrzeugscheine und Service-Hefte per Foto analysieren
- **Wartungs-Dashboard** — Übersicht über fällige, überfällige und erledigte Wartungen pro Fahrzeug
- **KI-Chat-Assistent** — Floating Chat mit Tool-Calling: Fahrzeuge verwalten, Dokumente scannen, Wartungsstatus abfragen
- **Multi-Provider AI** — OpenRouter (Gemini), Anthropic Claude, OpenAI, Mistral (Pixtral), Meta Llama
- **Echtzeit-Sync** — InstantDB als Backend mit WebSocket-Sync
- **PWA** — Installierbar auf Smartphone und Desktop

## Tech Stack

| Bereich | Technologie |
|---------|-------------|
| Frontend | Vue 3, Quasar, Pinia, Vue Router |
| Datenbank | InstantDB (self-hosted, PostgreSQL + WebSocket) |
| AI | Vercel AI SDK v6, Zod |
| Build | Vite, TypeScript, PWA (Workbox) |
| Tests | Playwright (E2E) |
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
npm run dev
```

Die App läuft auf `http://localhost:5173`.

### InstantDB Server stoppen

```bash
cd ~/instant/server && podman-compose -f docker-compose-dev.yml down
```

### AI konfigurieren

1. App öffnen → **Einstellungen**
2. AI-Provider wählen (empfohlen: OpenRouter)
3. API-Key eingeben

## Befehle

```bash
npm run dev          # Entwicklungsserver
npm run build        # Produktions-Build
npm run lint         # ESLint prüfen
npm run lint:fix     # ESLint auto-fix
npm run test:e2e     # Playwright E2E-Tests
npm run test:e2e:ui  # Playwright im UI-Modus
```

## Projektstruktur

```
src/
  pages/          Dashboard, Fahrzeuge, Scan, Einstellungen, Fahrzeug-Detail
  components/     ChatDrawer, InvoiceResult, InvoiceScanner, VehicleCard, VehicleForm
  services/       AI (Multi-Provider), Chat (Tool-Calling), Wartungsplan
  stores/         Pinia Stores (Fahrzeuge, Rechnungen, Wartungen, Einstellungen)
  lib/            InstantDB Client
  composables/    useImageResize (Client-seitige Bildoptimierung)
e2e/              Playwright Tests + Test-Fixtures
scripts/          AI-Provider-Vergleichsskript
```

## AI-Provider

| Provider | Modell | Vision | Chat | Tool Calling | Kosten |
|----------|--------|--------|------|-------------|--------|
| **OpenRouter** | Gemini 2.0 Flash | Ja | Ja | Ja | Free Tier |
| Anthropic | Claude Sonnet | Ja | Ja | Ja | Bezahlt |
| OpenAI | GPT-4o Mini | Ja | Ja | Ja | Bezahlt |
| Mistral | Pixtral Large (via OpenRouter) | Ja | Ja | Ja | Free Tier |
| Meta Llama | Llama 4 Maverick (via OpenRouter) | Ja | Ja | Ja | Free Tier |

### Datenschutz-Warnung

**Bei kostenlosen API-Tiers bezahlt man mit seinen Daten:**

| Provider | Trainiert mit Daten? | EU-konform? |
|----------|---------------------|-------------|
| OpenRouter + Gemini Free | **Ja** — Google trainiert mit Free-Tier-Daten | **Nein** — Free Tier in EU nicht erlaubt |
| Mistral Free (Experiment) | **Ja** — Standard ist Training, Opt-out möglich | Ja |
| Meta Llama API | Nein | **Eingeschränkt** — Vision-Modelle in EU limitiert |
| Anthropic API (bezahlt) | Nein | Ja |
| OpenAI API (bezahlt) | Nein (seit März 2023) | Ja |
| Ollama (lokal) | **Nein** — 100% privat, keine Daten verlassen den Rechner | Ja |

> **Empfehlung:** Für maximale Privatsphäre Ollama lokal nutzen (GPU erforderlich) oder bezahlte APIs (Anthropic, OpenAI).

### Ollama (lokaler Provider)

Getestet mit Ollama 0.15.2, `qwen3-vl:2b`, NVIDIA Quadro P1000 (4 GB VRAM):

| Test | Ergebnis | Zeit |
|------|----------|------|
| Vision (Rechnungsscan) | Korrekt | ~13s |
| Tool Calling | Korrekt | ~7s |

```bash
# Installation
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen3-vl:2b

# Testen
ollama run qwen3-vl:2b "Beschreibe dieses Bild" bild.png
```

> **Hinweis:** Bei GPUs mit wenig VRAM (<8 GB) nutzt Ollama den "low VRAM mode" (GPU+CPU Mix).
> Das 4B-Modell hängt auf 4 GB VRAM — das 2B-Modell wird empfohlen.

## E2E-Tests

### Test-Katalog

Die E2E-Tests sind nummeriert für präzise Referenzierung in Bug-Reports und CI-Logs:

| Präfix | Bereich | Tests |
|--------|---------|-------|
| **VF** | Vehicle Flow | VF-001 bis VF-003 (Fahrzeug hinzufügen, Dashboard, löschen) |
| **DF** | Delete Flow | DF-001, DF-002 (Löschdialog, Scan-Tabs) |
| **SF** | Scan Flow | SF-001 (Scanner UI) |
| **IS** | Invoice Scan | IS-001 (Rechnung scannen + speichern) |
| **VD** | Vehicle Document | VD-001, VD-002 (Kaufvertrag, Service-Heft) |
| **CR** | CRUD Operations | CR-001 bis CR-009 (Fahrzeug/Rechnung/Wartung bearbeiten/löschen) |
| **RF** | Rotation Flow | RF-001 (Auto-Rotation Querformat) |
| **CF** | Chat Flow | CF-001 bis CF-004 (Tool-Calling, Multi-Image) |
| **SC** | Schedule Flow | SC-001 (Wartungsplan via Chat) |
| **SH** | Schedule Hint | SH-001, SH-002 (Banner mit/ohne customSchedule) |
| **SE** | Settings Flow | SE-001, SE-002 (Provider-Auswahl, Export/Import) |
| **CI** | Chat Image | CI-001 (Auto-Rotation im Chat) |
| **CS** | Chat Schedule | CS-001, CS-002 (Service-Heft-Hinweis im Chat) |
| **MV** | MediaViewer | MV-001, MV-002 (Optimierung, OCR-Tab) |

**Gesamt: 33 Tests in 14 Dateien**

Tests nutzen echte AI-APIs (OpenRouter). Keys werden aus `.env` geladen:

```bash
# .env (nicht committet)
OPENROUTER_API_KEY=...
```

Test-Fixtures (Rechnungen, Kaufverträge, Service-Hefte) werden generiert:

```bash
npx tsx e2e/generate-fixture.ts
```

## Lizenz

Privat
