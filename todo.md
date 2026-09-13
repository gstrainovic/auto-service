# todo.md

Reihenfolge, nicht Themen. Erst Validierung (business-plan/09-validierung.md), dann Betrieb für den Pilot, dann alles andere. Kein Zahlungsanbieter und keine Werbung vor dem Entscheid.

## Jetzt: Validierung (Woche 1 bis 4)

Voraussetzung vor der ersten E-Mail: Eine erreichbare Website mit Impressum und den zwei Landing Pages. Die App selbst muss dafür nicht laufen.

- [ ] Landing Pages «Betrieb» und «Privathalter» plus Impressum und Datenschutz als statische Seiten unter der Domain veröffentlichen (kein InstantDB, kein Proxy), Formular mit E-Mail-Feld, Plausible
- [ ] Beobachten (M1): zwei Abende lesen, wo Kleinbetriebe mit mehreren Fahrzeugen (Rezensionen von Fuhrpark-Apps, Handwerker- und KMU-Gruppen, Gewerbeverbände) und Privathalter (Motor-Talk, App-Store-Rezensionen Drivvo/Fuelio/TCS MyRide) über das Problem reden; Zitate und Quellen in `business-plan/beobachtungen.md`
- [ ] Liste mit 20 Betrieben in der Ostschweiz mit 3 bis 15 Fahrzeugen (Sanitär, Elektro, Gartenbau, Malerei, Spitex, Hauswartung), mit E-Mail-Adresse
- [ ] 20 E-Mails einzeln nach der Vorlage in Kapitel 9 (M2) versenden, nach 10 Tagen einmal nachfassen, Antworten protokollieren
- [ ] Ein Forumsbeitrag mit echter Frage (Motor-Talk oder r/de)
- [ ] Auswertung gegen die Abbruchkriterien, Ergebnis und Entscheid in Kapitel 9 eintragen

## Sobald ein Betrieb Ja sagt: Betrieb für den Pilot

Erst dann lohnt sich der Server. Bis zur Einrichtung beim ersten Betrieb bleiben etwa zwei Wochen.

- [ ] VM bestellen (2 vCPU, 4 GB), DNS für `app.`, `ai.`, `api.`, `dash.`, `files.` anlegen
- [ ] InstantDB nach offiziellem VPS-Guide aufsetzen: `JAVA_OPTS=-Xmx2g -Xms2g`, Superuser, Signups "Closed", temporäre Apps aus, E-Mail-Provider (Postmark braucht Sending-Approval für fremde Domains)
- [ ] Perms pushen (`instant-cli push perms` gegen eigene Instanz) und mit zweitem Nutzer verifizieren, dass `vehicles`/`usage` nur eigene Daten liefern
- [ ] PWA bauen (`.env` mit `VITE_INSTANTDB_MODE=selfhosted`, `VITE_AI_PROXY_URL`) und `deploy/` starten; Health-Checks beider Dienste in Uptime-Monitoring aufnehmen
- [ ] Backup-Cron (`pg_dump` → Hetzner Storage Box), Restore einmal durchspielen
- [ ] Grundhärtung: Firewall nur 22/80/443, SSH nur Key, automatische Updates
- [ ] Erster echter Login-Test mit Magic Code auf der VM (Proxy prüft dann echte Refresh-Tokens, kein Bypass)
- [ ] Mistral Scale-Tier (kein Training) buchen und AVV/DPA abschliessen
- [ ] Pilot-Betrieb anlegen: Fahrzeuge erfassen, erste Rechnungen von Hand einlesen, Jahresrechnung per QR-Rechnung stellen (kein Zahlungsanbieter)

## Nach dem Entscheid

Bei bestätigter Kleinbetriebs-Hypothese (H1):
- [ ] Mehrere Nutzer pro Konto (Fahrer wirft Rechnung ein, Inhaber sieht alles)
- [ ] Kostenübersicht pro Fahrzeug und Jahr, Export für den Treuhänder
- [ ] Preis aus den Antworten festlegen, `src/shared/plans.ts` und Businessplan angleichen

Bei bestätigter Privathalter-Hypothese (H2):
- [ ] Jahresabo 36 CHF per QR-Rechnung an die Warteliste, Kanäle aus Kapitel 5

Zahlungsanbieter Payrexx (Entscheid und Preise in business-plan/04), erst wenn ein Kunde monatlich per Karte statt Rechnung zahlen will:
- [ ] Payrexx-Konto anlegen (Standard, Startup-Rabatt), verifizieren, Payrexx Pay aktivieren, Testmodus, API-Key und Webhook-Signing-Key notieren
- [ ] ai-proxy: austauschbare Billing-Schnittstelle, Stripe behalten, Payrexx ergänzen (Gateway mit subscriptionState, Webhook X-Webhook-Signature HMAC-SHA256 hex, Status active/overdue/failed/cancelled/in_notice, Kundenportal POST /AuthToken, Kündigen DELETE /Subscription/{id}); Tests gegen dokumentierte Payloads
- [ ] App auf Payrexx umstellen (PAYREXX_INSTANCE, PAYREXX_API_SECRET, PAYREXX_WEBHOOK_SECRET), Checkout und Kündigung im Testmodus durchspielen
- [ ] Datenschutzerklärung: Hosting Hetzner, Mistral (FR), Payrexx (CH)
- [ ] Settings: "Abo verwalten"-Button (`POST /billing/portal`), nach Rückkehr vom Checkout Nutzung neu laden und Toast zeigen
- [ ] Limit-Meldung im Chat mit Link zu den Einstellungen statt nur Text

## Geparkt

- [ ] Businessplan: Preise in `src/shared/plans.ts` (5/15 CHF) und Kapitel 4 (3/7 EUR) angleichen, sobald der Preis aus der Validierung feststeht; Kapitel 8 R2 (InstantDB-Cloud eingestellt, Abschaltung 31.08.2027) als eingetreten vermerken
- [ ] InstantDB auf 1.x heben (Server-Checkout `~/instant` vom 02.02.2026, `@instantdb/core` + `@instantdb/admin` auf 0.22.121 gepinnt). Erst Server, dann beide Pakete gemeinsam, dann E2E + `npm run test:unit`. Nicht während eines laufenden Pilots.
