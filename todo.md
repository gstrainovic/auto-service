# todo.md

Reihenfolge, nicht Themen. Erst Validierung (business-plan/09-validierung.md), dann Betrieb für den Pilot, dann alles andere. Kein Zahlungsanbieter und keine Werbung vor dem Entscheid.

## Jetzt: einmal online stellen, dann Validierung

Ausführung: Claude. Beim Nutzer bleiben drei Dinge: Domain und Server kaufen (Infomaniak, ein Konto für beides), API-Token für DNS ablegen, und das einmalige Ja zum Versand eines vorbereiteten E-Mail-Stapels. Keine Telefonate, keine Gespräche.

Entschieden: Kein Zwischenschritt über GitHub Pages (deren Nutzungsbedingungen schliessen Marketing für kommerzielle SaaS aus). Die PWA bekommt die Landing Pages als öffentliche Routen und wird einmal komplett auf dem echten Server veröffentlicht. Server: Infomaniak Public Cloud (OpenStack, Schweiz), Instanz `a2_ram4_disk50_perf1` mit reservierter IPv4, rund 14 CHF/Monat, die ersten drei Monate aus dem Startguthaben; Vergleich mit VPS Lite, Jelastic und Hetzner in business-plan/06. Domain `wartungsheft.ch` ist gekauft.

### Vom Nutzer
- [ ] Im Infomaniak-Manager die Public Cloud aktivieren (Kreditkarte, Startguthaben 300 CHF), Projekt `wartungsheft` anlegen
- [ ] Im Projekt ein OpenStack Application Credential erstellen und ID plus Secret als `~/.config/infomaniak/openstack.env` ablegen
- [ ] Infomaniak-API-Token mit Rechten für Domain/DNS erstellen und als `~/.config/infomaniak/token` ablegen

### Von Claude, Server
- [ ] Instanz per OpenStack-CLI anlegen: `a2_ram4_disk50_perf1`, Debian oder Ubuntu LTS, SSH-Key, Security Group nur 22/80/443, reservierte IPv4
- [ ] DNS per Infomaniak-API: `wartungsheft.ch`, `www.`, `app.`, `ai.`, `api.`, `dash.`, `files.` auf die Instanz-IP
- [ ] Grundhärtung: SSH nur Key, automatische Updates, Docker
- [ ] Snapshot der Instanz vor jeder riskanten Änderung (InstantDB-Upgrade, grössere Migrationen)
- [ ] InstantDB nach offiziellem VPS-Guide: `JAVA_OPTS=-Xmx2g -Xms2g`, Superuser, Signups "Closed", temporäre Apps aus, E-Mail-Provider (Postmark braucht Sending-Approval für die Domain)
- [ ] Perms pushen (`instant-cli push perms` gegen eigene Instanz) und mit zweitem Nutzer verifizieren, dass `vehicles`/`usage` nur eigene Daten liefern
- [ ] Landing Pages «Betrieb» und «Privathalter» als öffentliche Routen in der PWA, Formular mit E-Mail-Feld (Speicherung in InstantDB), Impressum und Datenschutz aktuell, Plausible
- [ ] PWA bauen (`.env` mit `VITE_INSTANTDB_MODE=selfhosted`, `VITE_AI_PROXY_URL`) und `deploy/` starten; Health-Checks beider Dienste in Uptime-Monitoring aufnehmen
- [ ] Backup-Cron (`pg_dump` auf ein Backup-Volumen im Projekt, zusätzlich täglicher Instanz-Snapshot), Restore einmal durchspielen
- [ ] Erster echter Login-Test mit Magic Code auf dem Server (Proxy prüft dann echte Refresh-Tokens, kein Bypass)
- [ ] Mistral Scale-Tier (kein Training) buchen und AVV/DPA abschliessen (Nutzer bestätigt den Kauf)
- [ ] README «Produktion»: Hetzner durch Infomaniak ersetzen

### Von Claude, Validierung (Woche 1 bis 4 nach Go-live)
- [ ] Beobachten (M1): Rezensionen von Fuhrpark-Apps, Handwerker- und KMU-Gruppen, Gewerbeverbände, Motor-Talk, App-Store-Rezensionen Drivvo/Fuelio/TCS MyRide auswerten; Zitate und Quellen in `business-plan/beobachtungen.md`
- [ ] Liste mit 20 Betrieben in der Ostschweiz mit 3 bis 15 Fahrzeugen (Sanitär, Elektro, Gartenbau, Malerei, Spitex, Hauswartung), mit E-Mail-Adresse, aus local.ch und Gemeindeverzeichnissen
- [ ] 20 E-Mails nach der Vorlage in Kapitel 9 (M2) als Entwürfe in Gmail anlegen, Nutzer gibt den Stapel mit einem Ja frei, Versand einzeln; nach 10 Tagen Nachfass-Stapel gleich; Antworten aus dem Posteingang protokollieren
- [ ] Ein Forumsbeitrag mit echter Frage (Motor-Talk oder r/de), Text vorbereiten, Nutzer gibt frei
- [ ] Auswertung gegen die Abbruchkriterien, Ergebnis und Entscheid in Kapitel 9 eintragen
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
