# Auto-Service PWA

## Commands
npm run dev          # Vite dev server on :5173
npm run build        # vue-tsc + vite build
npm run lint         # ESLint (antfu config)
npm run lint:fix     # ESLint autofix
npm run test:e2e     # Playwright E2E (loads .env + .env.test via dotenv)
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
Three providers via Vercel AI SDK v6 + @ai-sdk/openai (OpenAI-compatible):
- **openrouter** (gemini-2.0-flash-001) — primary, best for vision+chat, no quota issues
- **anthropic** (claude-sonnet-4-20250514)
- **openai** (gpt-4o-mini)

Removed providers (2025-01 comparison): Google direct (quota limits), Groq (vision decommissioned),
Mistral (model not found), Ollama (very slow, inaccurate on CPU).

Provider + API key in localStorage (Settings page). .env only for E2E tests.

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
