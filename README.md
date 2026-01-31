# Auto-Service

Offline-fähige PWA zur Verwaltung von Fahrzeugen, Wartungen und Werkstattrechnungen — mit KI-gestütztem Dokumenten-Scanner und Chat-Assistent.

## Features

- **Fahrzeugverwaltung** — Fahrzeuge anlegen, bearbeiten, löschen mit Kilometerstand-Tracking
- **KI-Dokumenten-Scanner** — Rechnungen, Kaufverträge, Fahrzeugscheine und Service-Hefte per Foto analysieren
- **Wartungs-Dashboard** — Übersicht über fällige, überfällige und erledigte Wartungen pro Fahrzeug
- **KI-Chat-Assistent** — Floating Chat mit Tool-Calling: Fahrzeuge verwalten, Dokumente scannen, Wartungsstatus abfragen
- **Multi-Provider AI** — OpenRouter (Gemini 2.0 Flash), Anthropic Claude, OpenAI
- **Offline-First** — RxDB als lokale Datenbank, funktioniert ohne Server
- **PWA** — Installierbar auf Smartphone und Desktop

## Tech Stack

| Bereich | Technologie |
|---------|-------------|
| Frontend | Vue 3, Quasar, Pinia, Vue Router |
| Datenbank | RxDB (offline-first, IndexedDB) |
| AI | Vercel AI SDK v6, Zod |
| Build | Vite, TypeScript, PWA (Workbox) |
| Tests | Playwright (E2E) |
| Linting | ESLint (antfu config) |

## Schnellstart

```bash
npm install
npm run dev
```

Die App läuft auf `http://localhost:5173`.

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
  db/             RxDB Schema + Initialisierung
  composables/    useDatabase()
e2e/              Playwright Tests + Test-Fixtures
scripts/          AI-Provider-Vergleichsskript
```

## AI-Provider

| Provider | Modell | Eignung |
|----------|--------|---------|
| **OpenRouter** | gemini-2.0-flash-001 | Vision + Chat, empfohlen (**3.2s**, akkurat) |
| Anthropic | claude-sonnet-4 | Chat |
| OpenAI | gpt-4o-mini | Chat |

> **Vergleich (Jan 2026):** OpenRouter war der einzige Provider mit zuverlässiger Vision-Erkennung.
> Google direkt hatte Quota-Limits, Groq hat Vision-Modelle deaktiviert, Mistral-Modelle nicht gefunden,
> Ollama (lokal) war extrem langsam (~18s) und ungenau.

## E2E-Tests

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
