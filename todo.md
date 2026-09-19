# todo.md

Reihenfolge, nicht Themen. Erst produktiv verkaufen (Bestellung und Rechnung für Betriebe), dann messen
(business-plan/09-validierung.md), dann alles andere. Keine Kaltakquise per E-Mail, keine Umfrage-Mails.

## Jetzt: produktiv gehen

### Vom Nutzer
- [ ] Mistral: monatliches Ausgabenlimit über das 10-$-Kontingent hinaus (heute 0 $) auf z. B. 20 $ setzen, sobald ein
      Betrieb scannt; sonst stoppt die API bis zum Monatsersten
- [ ] Rechnungsweg entscheiden: QR-Rechnung selbst erzeugen (swissqrbill) oder AbaNinja, bexio usw.

### Von Claude
- [ ] Betrieb bestellt das Jahresabo in der App: Formular fragt Firma, Kontaktperson, Rechnungsadresse (Strasse,
      PLZ, Ort), Rechnungs-E-Mail und optional Referenz/Kostenstelle ab; Fahrzeugzahl vorbelegt mit den aktiven
      Fahrzeugen. Zugang sofort, Rechnung zahlbar in 30 Tagen. Verlängert sich jährlich, kündbar bis zum Ablauf ohne
      Frist; Rechnung 30 Tage vor Ablauf nach dem dann aktuellen Fahrzeugstand
- [ ] Hinweis vor Ende der Testzeit: in der App ab Tag 23 und eine Mail 7 Tage vorher (Erinnerungs-Job
      `scripts/reminders.ts`), mit Link auf die Bestellung
- [ ] Fahrzeuggrenze wirklich sperren, sobald ein Zahlungsweg existiert: `vehicleLimit` meldet heute nur, solange
      `VITE_BILLING_ENABLED=true` gesetzt ist; ohne Kaufweg wäre eine Sperre bloss ein Ärgernis
- [ ] Health-Checks laufen heute nur im täglichen Claude-Lauf (`~/projects/find-jobs/AGENTS.md`, «Tagescheck
      Wartungsheft»). Sobald ein Betrieb zahlt, zusätzlich ein Dienst, der unabhängig vom Laptop prüft und meldet

### Messen, nebenbei
- [ ] Wöchentlich Zahlen ziehen (Caddy-Log, `events`, Anmeldungen, Bestellungen, Postfach, README Abschnitt 6) und in
      Kapitel 9 notieren; nach drei Monaten Auswertung gegen die Abbruchkriterien
- [ ] Beobachten (M1) ergänzen: Schweizer KMU-Stimmen (Gewerbeverbände, LinkedIn-Gruppen); Erstfassung steht in
      `business-plan/beobachtungen.md`
- [ ] Ein Forumsbeitrag mit echter Frage (Motor-Talk oder r/de), Text vorbereiten, Nutzer gibt frei

## Sobald über die Schweiz hinaus verkauft wird (DACH oder global)

Heute sind Währung (CHF), Zahlenformat (de-CH, `src/lib/locale.ts`) und Sprache (Deutsch) fest im Code. Vor dem ersten Kunden ausserhalb der Schweiz:
- [ ] Deploy-Standards pro Installation: Währung, Sprache, Zahlen- und Datumsformat, Kilometer/Meilen als Konfiguration (`VITE_*` oder Server-Einstellung), nicht als Konstante
- [ ] Nutzer-Einstellungen im Profil: eigene Währung, Sprache und Formate überschreiben die Deploy-Standards; Rechnungen behalten ihre Original-Währung
- [ ] Texte über i18n (vue-i18n oder gleichwertig), DE zuerst, EN als zweite Sprache; Landing Pages und Datenschutz je Sprache
- [ ] Preise und Pläne pro Land (`plans.ts`): Währung, MWST-Hinweis, Zahlungsanbieter je Region (Kapitel 4 und 6 im Businessplan: EU-Privatkunden nur mit OSS-Registrierung oder Merchant of Record)

## Nach dem Entscheid

Bei bestätigter Kleinbetriebs-Hypothese (H1):
- [ ] Mehrere Nutzer pro Konto (Fahrer wirft Rechnung ein, Inhaber sieht alles)

Bei bestätigter Privathalter-Hypothese (H2):
- [ ] Jahresabo 25 CHF per QR-Rechnung an die angemeldeten Nutzer nach der Testzeit, Kanäle aus Kapitel 5

Zahlungsanbieter Payrexx (Entscheid und Preise in business-plan/04), erst wenn ein Kunde monatlich per Karte statt Rechnung zahlen will:
- [ ] Payrexx-Konto anlegen (Standard, Startup-Rabatt), verifizieren, Payrexx Pay aktivieren, Testmodus, API-Key und Webhook-Signing-Key notieren
- [ ] ai-proxy: austauschbare Billing-Schnittstelle, Stripe behalten, Payrexx ergänzen (Gateway mit subscriptionState, Webhook X-Webhook-Signature HMAC-SHA256 hex, Status active/overdue/failed/cancelled/in_notice, Kundenportal POST /AuthToken, Kündigen DELETE /Subscription/{id}); Tests gegen dokumentierte Payloads
- [ ] App auf Payrexx umstellen (PAYREXX_INSTANCE, PAYREXX_API_SECRET, PAYREXX_WEBHOOK_SECRET), Checkout und Kündigung im Testmodus durchspielen
- [ ] Preise je Plan bei Payrexx hinterlegen (`privat` 25 CHF im Jahr, `betrieb` 36 CHF pro Fahrzeug und Jahr mit Menge)
- [ ] Datenschutzerklärung: Payrexx (CH) ergänzen
- [ ] Settings: "Abo verwalten"-Button (`POST /billing/portal`), nach Rückkehr vom Checkout Nutzung neu laden und Toast zeigen
- [ ] Limit-Meldung im Chat mit Link zu den Einstellungen statt nur Text

## Geparkt

- [ ] InstantDB-Client auf 1.x heben (`@instantdb/core` + `@instantdb/admin` auf 0.22.121 gepinnt, lokaler Server-Checkout `~/instant` vom 02.02.2026; Produktion läuft schon mit Server-Image `latest`). Erst lokalen Server aktualisieren, dann beide Pakete gemeinsam, dann E2E + `npm run test:unit`. Nicht während eines laufenden Pilots.
