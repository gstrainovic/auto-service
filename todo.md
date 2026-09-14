# todo.md

Reihenfolge, nicht Themen. Erst Validierung (business-plan/09-validierung.md), dann Betrieb für den Pilot, dann alles andere. Kein Zahlungsanbieter und keine Werbung vor dem Entscheid.

Die App läuft unter https://wartungsheft.ch (Landing Pages `/betrieb` und `/privathalter`, Login mit Magic Code, AI-Proxy unter `ai.`, InstantDB unter `api.`/`dash.`/`files.`). Betrieb und Befehle: README «Produktion», CLAUDE.md «Produktion».

## Jetzt: Validierung (Woche 1 bis 4)

Ausführung: Claude. Beim Nutzer bleibt das einmalige Ja zum Versand eines vorbereiteten E-Mail-Stapels. Keine Telefonate, keine Gespräche.

### Vom Nutzer
- [ ] Mistral: monatliches Ausgabenlimit über das 10-$-Kontingent hinaus (heute 0 $) auf z. B. 20 $ setzen, sobald ein Pilotbetrieb scannt; sonst stoppt die API bis zum Monatsersten

### Von Claude
- [ ] Beobachten (M1) ergänzen: Pro-Preise von Drivvo und Fuelio in CHF, Schweizer KMU-Stimmen (Gewerbeverbände, LinkedIn-Gruppen); Erstfassung steht in `business-plan/beobachtungen.md`
- [ ] 20 E-Mails nach der Vorlage in Kapitel 9 (M2) für die Betriebe aus `business-plan/betriebe.md` vorbereiten, Link auf https://wartungsheft.ch/betrieb, Nutzer gibt den Stapel mit einem Ja frei, Versand einzeln (höchstens fünf pro Tag); nach 10 Tagen Nachfass-Stapel gleich; Antworten protokollieren
- [ ] Ein Forumsbeitrag mit echter Frage (Motor-Talk oder r/de), Text vorbereiten, Nutzer gibt frei
- [ ] Wöchentlich Zahlen ziehen (Caddy-Log, `leads`, `events`, README Abschnitt 6) und in Kapitel 9 notieren
- [ ] Auswertung gegen die Abbruchkriterien, Ergebnis und Entscheid in Kapitel 9 eintragen
- [ ] Pilot-Betrieb anlegen: Fahrzeuge erfassen, erste Rechnungen von Hand einlesen, Jahresrechnung per QR-Rechnung stellen (kein Zahlungsanbieter)

### Betrieb, nebenbei
- [ ] Backups zusätzlich ausserhalb der Instanz ablegen (Object Storage im selben OpenStack-Projekt, eigenes Application Credential nur dafür); Restore einmal nach README durchspielen
- [ ] Health-Checks (`api.`/health/system, `ai.`/health) in ein Uptime-Monitoring aufnehmen, sobald ein Pilot läuft

## Sobald über die Schweiz hinaus verkauft wird (DACH oder global)

Heute sind Währung (CHF), Zahlenformat (de-CH, `src/lib/locale.ts`) und Sprache (Deutsch) fest im Code. Vor dem ersten Kunden ausserhalb der Schweiz:
- [ ] Deploy-Standards pro Installation: Währung, Sprache, Zahlen- und Datumsformat, Kilometer/Meilen als Konfiguration (`VITE_*` oder Server-Einstellung), nicht als Konstante
- [ ] Nutzer-Einstellungen im Profil: eigene Währung, Sprache und Formate überschreiben die Deploy-Standards; Rechnungen behalten ihre Original-Währung
- [ ] Texte über i18n (vue-i18n oder gleichwertig), DE zuerst, EN als zweite Sprache; Landing Pages und Datenschutz je Sprache
- [ ] Preise und Pläne pro Land (`plans.ts`): Währung, MWST-Hinweis, Zahlungsanbieter je Region (Kapitel 4 und 6 im Businessplan: EU-Privatkunden nur mit OSS-Registrierung oder Merchant of Record)

## Nach dem Entscheid

Bei bestätigter Kleinbetriebs-Hypothese (H1):
- [ ] Mehrere Nutzer pro Konto (Fahrer wirft Rechnung ein, Inhaber sieht alles)
- [ ] Kostenübersicht über alle Fahrzeuge (Betrieb): Summe pro Fahrzeug und Jahr auf dem Dashboard, Export über den ganzen Fuhrpark; pro Fahrzeug ist beides schon da (Tab «Kosten», CSV, PDF-Dossier)
- [ ] Gemischte Währungen (Grenzregion, EUR-Rechnungen): Umrechnung in die Heimwährung des Kontos zum Kurs am Rechnungsdatum für Jahresübersicht und Export, Originalbetrag und -währung bleiben an der Rechnung; bis dahin summiert das Dashboard pro Währung getrennt
- [ ] Preis aus den Antworten festlegen, `src/shared/plans.ts` und Businessplan angleichen

Bei bestätigter Privathalter-Hypothese (H2):
- [ ] Jahresabo 36 CHF per QR-Rechnung an die Warteliste, Kanäle aus Kapitel 5

Zahlungsanbieter Payrexx (Entscheid und Preise in business-plan/04), erst wenn ein Kunde monatlich per Karte statt Rechnung zahlen will:
- [ ] Payrexx-Konto anlegen (Standard, Startup-Rabatt), verifizieren, Payrexx Pay aktivieren, Testmodus, API-Key und Webhook-Signing-Key notieren
- [ ] ai-proxy: austauschbare Billing-Schnittstelle, Stripe behalten, Payrexx ergänzen (Gateway mit subscriptionState, Webhook X-Webhook-Signature HMAC-SHA256 hex, Status active/overdue/failed/cancelled/in_notice, Kundenportal POST /AuthToken, Kündigen DELETE /Subscription/{id}); Tests gegen dokumentierte Payloads
- [ ] App auf Payrexx umstellen (PAYREXX_INSTANCE, PAYREXX_API_SECRET, PAYREXX_WEBHOOK_SECRET), Checkout und Kündigung im Testmodus durchspielen
- [ ] Datenschutzerklärung: Payrexx (CH) ergänzen
- [ ] Settings: "Abo verwalten"-Button (`POST /billing/portal`), nach Rückkehr vom Checkout Nutzung neu laden und Toast zeigen
- [ ] Limit-Meldung im Chat mit Link zu den Einstellungen statt nur Text

## Geparkt

- [ ] Businessplan: Preise in `src/shared/plans.ts` (5/15 CHF) und Kapitel 4 (3/7 EUR) angleichen, sobald der Preis aus der Validierung feststeht; Kapitel 8 R2 (InstantDB-Cloud eingestellt, Abschaltung 31.08.2027) als eingetreten vermerken
- [ ] InstantDB-Client auf 1.x heben (`@instantdb/core` + `@instantdb/admin` auf 0.22.121 gepinnt, lokaler Server-Checkout `~/instant` vom 02.02.2026; Produktion läuft schon mit Server-Image `latest`). Erst lokalen Server aktualisieren, dann beide Pakete gemeinsam, dann E2E + `npm run test:unit`. Nicht während eines laufenden Pilots.
