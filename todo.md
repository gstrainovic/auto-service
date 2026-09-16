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

### Versprechen der Landing Page einlösen
- [ ] Serviceheft-PDF für die Übergabe (Käufer-Mappe, eigener Knopf neben dem PDF-Dossier): erste Seite als Auszug
      (Fahrzeug, Kilometerstand, Zeitraum, Anzahl Einträge, lückenlos ja/nein, letzte Arbeiten), danach die
      Wartungshistorie, Belege als Anhang; Preise abwählbar, weil der Verkäufer seine Kosten selten zeigen will.
      Werbung dezent: letzte Seite mit den Funktionen von Wartungsheft, auf jeder Seite unten die Fusszeile mit
      wartungsheft.ch

### Bekannte Lücken, klein
- [ ] Bestehende Daten: beim Cayenne steht das Fahrzeug auf 231'457 km, der letzte Ölwechsel auf 252'586 km (neue Einträge heben den Stand, alte nicht); einmalig nachziehen, nach Rückfrage

### Betrieb, nebenbei
- [ ] **Vom Nutzer, einmalig:** In Horizon (https://api.pub2.infomaniak.cloud/horizon, Benutzer `PCU-CTPZLR8`) anmelden
      und unter «Identity → Application Credentials» ein Credential `claude-backup` **ohne Rollenauswahl** anlegen, damit
      es alle Rollen des Benutzers erbt; ID und Secret in `~/.config/openstack/clouds.yaml` als Cloud
      `PCP-CTPZLR8-backup` ablegen. Grund: das heutige Credential hat nur die Rolle `member`, Swift antwortet damit auf
      alles mit 403, und aus einem Application-Credential-Token heraus lässt sich kein zweites anlegen
      («Using method 'application_credential' is not allowed»). Danach übernehme ich: Container
      `wartungsheft-backups` anlegen, `backup.sh` um den Upload erweitern, Aufbewahrung im Container prüfen
- [ ] Health-Checks (`api.`/health/system, `ai.`/health) in ein Uptime-Monitoring aufnehmen, sobald ein Pilot läuft

### Preismodell

Umgesetzt: eine Preisliste, gestaffelt nach Fahrzeugen (36 CHF im Jahr für bis zu drei, jedes weitere 30 CHF),
KI-Kontingent pro Fahrzeug, beide Landing Pages gleich. Offen bleibt die Durchsetzung:

- [ ] Fahrzeuggrenze wirklich sperren, sobald ein Zahlungsweg existiert: `vehicleLimit` meldet heute nur, solange
      `VITE_BILLING_ENABLED=true` gesetzt ist; ohne Kaufweg wäre eine Sperre bloss ein Ärgernis
- [ ] Preise je Plan beim Zahlungsanbieter hinterlegen (Stripe- oder Payrexx-Preis-IDs `klein`, `mittel`, `gross`)

## Sobald über die Schweiz hinaus verkauft wird (DACH oder global)

Heute sind Währung (CHF), Zahlenformat (de-CH, `src/lib/locale.ts`) und Sprache (Deutsch) fest im Code. Vor dem ersten Kunden ausserhalb der Schweiz:
- [ ] Deploy-Standards pro Installation: Währung, Sprache, Zahlen- und Datumsformat, Kilometer/Meilen als Konfiguration (`VITE_*` oder Server-Einstellung), nicht als Konstante
- [ ] Nutzer-Einstellungen im Profil: eigene Währung, Sprache und Formate überschreiben die Deploy-Standards; Rechnungen behalten ihre Original-Währung
- [ ] Texte über i18n (vue-i18n oder gleichwertig), DE zuerst, EN als zweite Sprache; Landing Pages und Datenschutz je Sprache
- [ ] Preise und Pläne pro Land (`plans.ts`): Währung, MWST-Hinweis, Zahlungsanbieter je Region (Kapitel 4 und 6 im Businessplan: EU-Privatkunden nur mit OSS-Registrierung oder Merchant of Record)

## Nach dem Entscheid

Bei bestätigter Kleinbetriebs-Hypothese (H1):
- [ ] Mehrere Nutzer pro Konto (Fahrer wirft Rechnung ein, Inhaber sieht alles)
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
