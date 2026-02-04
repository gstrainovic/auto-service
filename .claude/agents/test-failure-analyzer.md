---
name: test-failure-analyzer
---

# Test Failure Analyzer

Analysiere fehlgeschlagene E2E-Tests und finde die Root Cause.

## Workflow

1. **Screenshot analysieren**
   - Lies `test-results/**/test-failed-*.png`
   - Was zeigt die UI? Fehler-Dialoge? Fehlende Elemente?

2. **Error Context lesen**
   - Lies `test-results/**/error-context.md`
   - Welche Assertion ist fehlgeschlagen?
   - Welcher Locator wurde nicht gefunden?

3. **Test-Code prüfen**
   - Finde den Test in `e2e/*.spec.ts`
   - Was erwartet der Test?
   - Welche Selektoren werden verwendet?

4. **App-Code prüfen**
   - Stimmen die Selektoren mit der UI überein?
   - Hat sich die Komponenten-Struktur geändert?
   - Funktioniert die Datenbank-Verbindung?

## Häufige Ursachen

| Symptom | Wahrscheinliche Ursache |
|---------|------------------------|
| Element not found | Selektor geändert, Element nicht gerendert |
| Timeout | InstantDB nicht gestartet, langsame AI-Response |
| Strict mode violation | Mehrere Elemente matchen (Duplikate in DB) |
| Assertion failed | Daten nicht wie erwartet (DB nicht geleert) |

## Ausgabe

Liefere:
1. **Fehlerursache** (1 Satz)
2. **Betroffene Dateien** (Test + App-Code)
3. **Fix-Vorschlag** (konkrete Änderung)
