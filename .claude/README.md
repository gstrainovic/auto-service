# Claude Code Setup für auto-service

Dieses Verzeichnis legt fest, welche Claude-Code-Erweiterungen in diesem Projekt
aktiv sind. Die Einträge in `settings.json` überschreiben die globalen Einstellungen
aus `~/.claude/settings.json` nur für dieses Repo. Andere Projekte sind nicht betroffen.

Stand: 2026-09-05

## Plugins (`enabledPlugins` in settings.json)

Alle acht global installierten Plugins sind hier explizit gelistet, damit die
globale Konfiguration keinen Einfluss mehr hat.

| Plugin | Status | Begründung |
|--------|--------|------------|
| playwright | ein | Browser-MCP für Screenshots und manuelle Verifikation der PWA. Das Projekt nutzt Playwright für E2E-Tests. |
| commit-commands | ein | `/commit` und `/commit-push-pr`. Leichtgewichtig, nur Slash-Commands. |
| claude-md-management | ein | `/revise-claude-md` und CLAUDE.md-Audit. Die CLAUDE.md dieses Projekts wird aktiv gepflegt. |
| frontend-design | ein | Design-Skill für UI-Arbeit an Landing Page, Dashboard und Komponenten. Lädt nur bei Bedarf. |
| security-guidance | aus | Hooks auf jedem Prompt, jedem Tool-Aufruf und beim Stop. Zu viel Latenz für ein Solo-Projekt. Bei Bedarf `/security-review` nutzen, das ist eingebaut. |
| claude-security | aus | Multi-Agent-Scanner mit hohem Token-Verbrauch. Nur gezielt vor einem Release einschalten. |
| claude-code-setup | aus | Einmaliger Automations-Empfehler, kein Dauerbedarf. |
| rust-analyzer-lsp | aus | Kein Rust in diesem Projekt. |
| context7 | ein | Aktuelle Doku für Vue, Quasar, PrimeVue, InstantDB, AI SDK per MCP. Passt zur Regel "erst Docs lesen, dann handeln". Läuft anonym, `CONTEXT7_API_KEY` optional für höhere Limits. Scope: project. |
| modern-web-guidance | ein | Skill von Google Chrome mit 104 Guides zu modernen Web-APIs (View Transitions, Popover, Container Queries, INP). Relevant für die PWA. Lädt bei Bedarf per npx. Scope: project. |
| typescript-lsp | ein | Language Server für die 49 `.ts`-Dateien (services, stores, lib, composables, e2e): Go-to-Definition, Referenzen, Typfehler. `.vue`-Dateien deckt er nicht ab. Voraussetzung: `npm install -g typescript-language-server typescript` (installiert, v6.0.0). Scope: project. |

### Katalog-Durchsicht (291 Plugins im offiziellen Marketplace, Stand 2026-09-05)

Geprüft wurden alle Einträge. Die grosse Mehrheit sind SaaS-Integrationen
(CRM, Cloud-Provider, Datenbanken, Observability) ohne Bezug zu diesem Stack.
Kandidaten, die zum Stack passen, aber bewusst nicht installiert wurden:

| Plugin | Warum nicht |
|--------|-------------|
| mattpocock-skills | TDD-, Grilling- und Triage-Workflows für TypeScript. Verlangt `/setup-matt-pocock-skills` pro Repo mit Issue-Tracker-Wahl. Opinionated, bei Interesse ausprobieren. |
| superpowers | Kompletter Workflow-Rahmen (Brainstorming, Subagent-Dev, TDD). Verändert die Arbeitsweise stark, nicht nebenbei aktivierbar. |
| chrome-devtools-mcp | Performance-Traces und Netzwerk-Analyse. Überschneidet sich mit playwright, das bereits läuft. |
| code-review, code-simplifier, pr-review-toolkit | Die eingebauten `/code-review` und `/simplify` decken das ab. |
| semgrep, sonarqube | Security-Scanner mit Hooks im Coding-Loop. Gleiche Begründung wie security-guidance. |
| github | `gh` CLI ist vorhanden und wird direkt genutzt. |
| vercel | Trotz "Vercel AI SDK" im Stack: Deployment läuft auf Hetzner, nicht Vercel. |

## Skills

### Projekt-Skills (`.claude/skills/`, immer aktiv)
- `e2e-test`: Playwright E2E-Tests ausführen, filtern, debuggen
- `instantdb-start`: lokalen InstantDB-Server starten, stoppen, Status prüfen

### Projekt-Agents (`.claude/agents/`)
- `test-failure-analyzer`: Root-Cause-Analyse fehlgeschlagener E2E-Tests

### Globale Skills (`~/.claude/skills/`)
- `zig`: hier per `skillOverrides` auf `off` gesetzt, kein Zig in diesem Projekt.
- `find-skills`: bleibt, kostet nichts und hilft beim Suchen neuer Skills.
- `zig-raylib-5.5`, `zig-sdl3-bindings`: haben keine `SKILL.md` und werden gar nicht geladen.

## MCP-Server

| Server | Quelle | Status hier | Wo gesteuert |
|--------|--------|-------------|--------------|
| playwright | Plugin | ein | `enabledPlugins` in dieser settings.json |
| context7 | Plugin (HTTP, mcp.context7.com) | ein | `enabledPlugins` in dieser settings.json |
| jina-reader | global (`~/.claude.json`) | ein | Globale Regel: alle URLs über Jina Reader fetchen |
| tmux-mcp | global | aus | `/mcp` im Projekt, gespeichert in `~/.claude.json` unter `projects[...].disabledMcpServers` |
| tui-driver | global | aus | wie tmux-mcp. Nur für TUI-Apps, hier nicht nötig. |
| Google Drive, Calendar, Gmail | claude.ai-Connectoren | aus | `disableClaudeAiConnectors: true` in dieser settings.json |

Hinweis: tmux-mcp und tui-driver sind nicht im Repo steuerbar, weil sie als
User-Server in `~/.claude.json` liegen. Wer das Repo neu klont, muss sie einmal
über `/mcp` deaktivieren, falls sie global aktiv sind.

## Hooks (settings.json)
- `PostToolUse` auf Edit/Write: ESLint-Autofix für die bearbeitete Datei
- `PreToolUse` auf Edit/Write: blockiert Änderungen an `.env` und `settings.local.json` (enthalten API-Keys)

## Änderungen vornehmen
- Plugin ein- oder ausschalten: Wert in `enabledPlugins` ändern oder `/plugin` mit Scope "project".
- Skill ausblenden: Eintrag in `skillOverrides` (`off`, `name-only`, `user-invocable-only`).
- Änderungen greifen beim nächsten Start von Claude Code.
