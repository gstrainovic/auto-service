# todo.md

Reihenfolge, nicht Themen. Erst produktiv verkaufen (Bestellung und Rechnung für Betriebe), dann messen
(business-plan/09-validierung.md), dann alles andere. Keine Kaltakquise per E-Mail, keine Umfrage-Mails.

## Jetzt: produktiv gehen

### Vom Nutzer
- [ ] Mistral: monatliches Ausgabenlimit über das 10-$-Kontingent hinaus (heute 0 $) auf z. B. 20 $ setzen, sobald ein
      Betrieb scannt; sonst stoppt die API bis zum Monatsersten
- [ ] PostFinance-Geschäftskonto eröffnen (Fr. 5 im Monat, bei Eröffnung bis 30.11.2026 zwei Jahre gratis) und
      QR-IBAN beantragen; neon, Yuh und Revolut privat verbieten geschäftliche Eingänge. IBAN danach in die `.env`
      des AI-Proxys auf der Instanz, nicht ins Repo. Bankwahl und Begründung in `geschaeftskonten-vergleich.md`
- [ ] Bei der Eröffnung zwei Formulare mitbestellen: «Anmeldung/Mutation virtuelles Konto QR-Rechnung» (QR-IBAN)
      und «Anmeldung/Mutation elektronische Kontodokumente» (camt.054). Beides ist gratis, solange die
      Detailavisierung halbtäglich oder täglich läuft; stündlich kostet CHF 0.08 pro Zahlung
      (`geschaeftskonten-vergleich.md`, «QR-IBAN und camt.054 bei PostFinance»)

### Von Claude
- [ ] Jahresabo Betrieb live schalten, sobald die IBAN da ist: `deploy/.env` auf der Instanz um `INVOICE_*`,
      `RESEND_TOKEN` und `AI_PROXY_INTERNAL_TOKEN` ergänzen, Proxy neu bauen, Cron `wartungsheft-billing` anlegen
      (README «8.»), Testbestellung mit eigener Adresse, PDF gegen den SIX-Validator prüfen, danach stornieren
- [ ] Tagescheck um `billing.mjs open` ergänzen: überfällige Rechnungen melden, Zahlungseingänge mit
      `camt <datei.xml>` aus dem heruntergeladenen camt.054 buchen. AbaNinja erst ab etwa 10 zahlenden Betrieben
- [ ] Fahrzeuggrenze wirklich sperren, sobald ein Zahlungsweg existiert: `vehicleLimit` meldet heute nur, solange
      `VITE_BILLING_ENABLED=true` gesetzt ist; ohne Kaufweg wäre eine Sperre bloss ein Ärgernis
- [ ] Fällt der Health-Workflow durch, ohne dass etwas kaputt ist (Wartungsfenster, kurzer Netzaussetzer), die
      Schwelle anheben: erst nach zwei Fehlläufen hintereinander mailen

### Marketing-Video
- [ ] Rückmeldung zu beiden Filmen: der Hintergrund blendet und das Tempo ist zu hoch. Szenen länger stehen lassen
      (Mindestdauer je Abschnitt in `scripts/video-build.sh`, Sprechertempo), Aufnahme mit dunklerer Oberfläche
      prüfen, danach neu aufnehmen und montieren (Skill `.claude/skills/werbefilm/SKILL.md`)
- [ ] Kurzfassungen für Social veröffentlichen: `video-out/social-privat.webm` und `social-betrieb.webm` (je gut
      10 Sekunden) beim ersten Beitrag oder der ersten Anzeige einsetzen

### Auffindbar, wenn jemand eine KI fragt
- [ ] Auf «Was ist wartungsheft.ch?» soll ChatGPT, Claude, Perplexity und Googles KI-Übersicht die richtige Antwort
      geben: Serviceheft mit Rechnungen pro Fahrzeug, Schweiz, 25 CHF privat / 36 CHF pro Fahrzeug im Betrieb,
      30 Tage gratis. Zuerst messen, was die vier heute antworten, dann nachbessern:
      Ein-Satz-Definition sichtbar oben auf der Startseite (nicht nur im Film), Preise, Grenzen und Antworten auf die
      häufigen Fragen als Text statt nur in Bild und Video, strukturierte Daten (`SoftwareApplication`,
      `Organization`, `FAQPage`), `/llms.txt` mit demselben Inhalt, `robots.txt` erlaubt GPTBot, ClaudeBot,
      PerplexityBot und Google-Extended. Danach dieselbe Frage nochmals stellen und den Unterschied notieren
- [ ] Seite `/hilfe` mit den neun Kernabläufen aus CLAUDE.md, je drei bis fünf Sätze, plus häufige Fragen als
      `FAQPage`. Dient dreifach: Antwort im Postfach statt Erklärung von Hand, Text für die KI-Antworten oben und
      Prüfliste für uns. Keine Bedienvideos: jede Änderung der Oberfläche macht sie falsch, und wer eine Anleitung
      braucht, zeigt eine Lücke in der Oberfläche — die Antwort gehört dann an die Stelle, nicht ins Handbuch
- [ ] `robots.txt` und `sitemap.xml` gibt es heute gar nicht (`vite.config.ts` listet `robots.txt` unter
      `includeAssets`, die Datei fehlt). Beide anlegen, dann die Indexierung anstossen:
      Google Search Console mit Domain-Property über einen DNS-TXT-Eintrag verifizieren (Infomaniak-API, Token in
      `~/.config/infomaniak/token`), Sitemap einreichen, die wichtigen Seiten einzeln über die URL-Prüfung zur
      Indexierung anmelden. Die Indexing API hilft nicht, sie gilt nur für `JobPosting` und `BroadcastEvent`.
      Dasselbe bei den Bing Webmaster Tools plus IndexNow (Schlüsseldatei im Web-Wurzelverzeichnis, ein Ping pro
      neuer URL): ChatGPT sucht über den Bing-Index, das zahlt direkt auf den Eintrag oben ein

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
