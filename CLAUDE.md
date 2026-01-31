# Auto-Service PWA

## Commands
npm run dev          # Vite dev server on :5173
npm run build        # vue-tsc + vite build
npm run lint         # ESLint (antfu config)
npm run lint:fix     # ESLint autofix
npm run test:e2e     # Playwright E2E (loads .env via dotenv)
npm run test:e2e:ui  # Playwright UI mode
npx tsx scripts/compare-ai.ts  # Compare AI providers on test invoice

## Architecture
Vue 3 + Quasar + Pinia + RxDB (offline-first) + Vercel AI SDK v6 + PWA

src/
  pages/          # DashboardPage, VehiclesPage, VehicleDetailPage, ScanPage, SettingsPage
  components/     # ChatDrawer, InvoiceResult, InvoiceScanner, VehicleCard, VehicleForm
  services/       # ai.ts (multi-provider), chat.ts (tool-calling), maintenance-schedule.ts
  stores/         # Pinia: vehicles, invoices, maintenances, settings
  db/             # RxDB schema + database init
  composables/    # useDatabase()
e2e/              # Playwright tests + fixtures/
scripts/          # compare-ai.ts

## AI Providers
Five cloud providers via Vercel AI SDK v6 + @ai-sdk/openai (OpenAI-compatible):
- **openrouter** (gemini-2.0-flash-001) — primary, best for vision+chat, no quota issues
- **anthropic** (claude-sonnet-4-20250514)
- **openai** (gpt-4o-mini)
- **mistral** (mistralai/pixtral-large-2411 via OpenRouter) — vision+chat+tools
- **meta-llama** (meta-llama/llama-4-maverick via OpenRouter) — vision+chat+tools

Removed providers (2025-01 comparison): Google direct (quota limits), Groq (vision decommissioned).

Provider + API key in localStorage (Settings page). .env only for E2E tests.

## Privacy / Datenschutz der Provider
WICHTIG: Bei kostenlosen API-Tiers bezahlt man mit seinen Daten.
- **OpenRouter + Gemini Free**: Google trainiert mit Free-Tier-Daten. In EU nicht erlaubt ohne Paid Tier.
- **Mistral Free (Experiment Plan)**: Daten werden standardmäßig für Training verwendet. Opt-out möglich.
- **Meta Llama API**: Kein Training mit API-Daten, ABER multimodale Modelle in EU eingeschränkt.
- **Anthropic API**: Kein Training mit API-Daten. 7 Tage Retention. Nicht kostenlos.
- **OpenAI API**: Kein Training seit März 2023. Nicht kostenlos.
- **Ollama (lokal)**: 100% privat — keine Daten verlassen den Rechner. Braucht GPU für akzeptable Geschwindigkeit.

## Ollama (lokaler Provider)
Getestetes Setup (Jan 2026): Ollama 0.15.2, qwen3-vl:2b, Quadro P1000 (4 GB VRAM), CUDA 13.0.
- Vision (Rechnungsscan): ~13s — korrekt (Werkstatt, Datum, Betrag)
- Tool Calling: ~7s — korrekt (list_vehicles)
- GPU wird im "low VRAM mode" genutzt (unter 20 GiB = Mischung GPU+CPU)
- qwen3-vl:4b (3.3 GB) hängt bei Vision auf 4 GB VRAM — 2b empfohlen
- Ollama API: http://localhost:11434, OpenAI-kompatibel via /v1/chat/completions

## Key Patterns
- AI SDK v6: `inputSchema` (not `parameters`), `stopWhen: stepCountIs(n)` (not maxSteps)
- Chat tools write directly to RxDB — no REST API layer
- Chat stepCount=2 to prevent duplicate tool calls
- z.enum(MAINTENANCE_CATEGORIES) enforces valid categories in AI schemas
- RxDB: optional fields can be added without schema version bump

## E2E Testing
- Quasar icon-only buttons need CSS class selectors (.chat-fab), not getByRole
- .env loaded by playwright.config.ts, keys injected via page.evaluate → localStorage
- All AI tests use OpenRouter (fast, accurate, ~3s for vision)
- Use .first() for assertions that may match multiple elements (AI can create duplicates)

## Code Style
- German UI text and AI schema descriptions
- antfu ESLint (no semicolons, single quotes, if-newline rule)
- All source TypeScript; eslint.config.js stays .js (ESLint compat)

## Gotchas
- Lint errors in docs/plans/*.md are false positives (code blocks parsed as JS)
- OpenRouter is the only provider tested for vision/scan — others may need model adjustments
