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
Multi-provider via Vercel AI SDK v6 + @ai-sdk/openai (OpenAI-compatible):
- google (Gemini 2.0 Flash) — default, quota limits on free tier
- openrouter (gemini-2.0-flash-001) — best for vision/scan, no quota issues
- groq (llama-3.3-70b-versatile) — fast text/tool-calling only, NO vision
- mistral, anthropic, openai
- ollama (qwen3 chat, minicpm-v vision) — local, very slow on CPU

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
- Vision tests use Ollama minicpm-v (slow ~18s, inaccurate) — prefer OpenRouter for CI
- Use .first() for assertions that may match multiple elements (AI can create duplicates)

## Code Style
- German UI text and AI schema descriptions
- antfu ESLint (no semicolons, single quotes, if-newline rule)
- All source TypeScript; eslint.config.js stays .js (ESLint compat)

## Gotchas
- Lint errors in docs/plans/*.md are false positives (code blocks parsed as JS)
- Groq: all vision models decommissioned — text/tool-calling only
- Gemini free tier: strict per-minute quota — use OpenRouter as fallback
- ollamaModel field is overloaded as generic model name for non-Ollama providers
