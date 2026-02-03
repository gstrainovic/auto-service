---
name: e2e-test
description: E2E-Tests ausführen, filtern und debuggen
disable-model-invocation: true
---

Führe Playwright E2E-Tests aus.

## Befehle
- Alle Tests: `npm run test:e2e`
- Einzelner Test: `npm run test:e2e -- --grep "VF-001"`
- Test-Gruppe: `npm run test:e2e -- --grep "vehicle-flow"`
- UI-Modus: `npm run test:e2e:ui`
- Liste alle Tests: `npm run test:e2e -- --list`

## Voraussetzungen
1. InstantDB Server muss laufen (nutze `/instantdb-start`)
2. Dev-Server startet automatisch via Playwright

## Test-ID Präfixe
| Präfix | Bereich |
|--------|---------|
| VF | Vehicle Flow |
| CF | Chat Flow |
| CR | CRUD Operations |
| IS | Invoice Scan |
| MV | MediaViewer |

## Wichtig
- Tests nutzen Mistral als Default-Provider
- API-Keys aus `.env` werden geladen
- `clearInstantDB()` löscht via Client-API (nicht SQL)
- Screenshots bei Fehlern: `test-results/**/test-failed-*.png`
