# todo.md

## Strategisch

- [ ] Businessplan aktualisieren: Risiko R2 (InstantDB eingestellt) ist eingetreten, Cloud-Abschaltung 31.08.2027;
      Hosting-Kosten (Self-Hosting ab ~30 USD/Monat), kein Vercel mehr, Abo-Modell mit Limits
      (`src/shared/plans.ts`: Free 5 Scans, Basic 5 CHF/60 Scans, Pro 15 CHF/400 Scans). Preise kalibrieren:
      Mistral-Kosten ~0,5 Rp pro Scan + Hosting-Grundlast.
- [ ] Mistral Scale-Tier (kein Training) buchen und AVV/DPA abschliessen. Datenschutz-Seite (`DatenschutzPage.vue`)
      anpassen: Vertrag läuft im Abo zwischen Nutzer und dir, Hosting Hetzner (DE), Mistral (FR), Payrexx (CH).
- [ ] InstantDB auf 1.x heben (Server-Checkout `~/instant` vom 02.02.2026, `@instantdb/core` + `@instantdb/admin`
      auf 0.22.121 gepinnt). Erst Server aktualisieren, dann beide Pakete gemeinsam, dann E2E + `npm run test:unit`.

## Deployment Hetzner (siehe README "Produktion auf Hetzner")

- [ ] VM bestellen (2 vCPU, 4 GB), DNS für `app.`, `ai.`, `api.`, `dash.`, `files.` anlegen.
- [ ] InstantDB nach offiziellem VPS-Guide aufsetzen: `JAVA_OPTS=-Xmx2g -Xms2g`, Superuser, Signups "Closed",
      temporäre Apps aus, E-Mail-Provider (Postmark braucht Sending-Approval für fremde Domains).
- [ ] Perms pushen (`instant-cli push perms` gegen eigene Instanz) und mit zweitem Nutzer verifizieren,
      dass `vehicles`/`usage` nur eigene Daten liefern.
- [ ] PWA bauen (`.env` mit `VITE_INSTANTDB_MODE=selfhosted`, `VITE_AI_PROXY_URL`) und `deploy/` starten;
      Health-Checks beider Dienste in Uptime-Monitoring aufnehmen.
- [ ] Backup-Cron (`pg_dump` → Hetzner Storage Box), Restore einmal durchspielen.
- [ ] Grundhärtung: Firewall nur 22/80/443, SSH nur Key, automatische Updates.
- [ ] Erster echter Login-Test mit Magic Code auf der VM (Proxy prüft dann echte Refresh-Tokens, kein Bypass).

## Zahlungsanbieter: Payrexx statt Stripe (Entscheidung 06.09.2026, geprüfte Preise)

Beste Preis-Leistung und Datenschutz: Schweizer Anbieter, Daten in der Schweiz, pro Zahlung rund 35 bis 40 Rappen
günstiger als Stripe (Karte 1,65 % + 0.18 statt 2,9 % + 0.30; TWINT 1,25 % + 0.18 statt 1,9 % + 0.30),
Standard-Abo 19 CHF/Monat, 30 % Startup-Rabatt, keine Einrichtungsgebühr. Abos später umzuziehen kostet Kunden,
deshalb von Anfang an Payrexx. Beide Apps (auto-service und dms) stellen um.

**Blockiert, bis das Payrexx-Konto beantragt und freigegeben ist** (Einzelunternehmen: Ausweis, Wohnsitznachweis,
Konto auf eigenen Namen; Handelsregister erst ab 100k Umsatz nötig).

- [ ] Payrexx-Konto anlegen (Standard, Startup-Rabatt), verifizieren, Payrexx Pay aktivieren, Testmodus einschalten, API-Key und Webhook-Signing-Key notieren
- [ ] ai-proxy: austauschbare Billing-Schnittstelle, Stripe-Implementierung behalten, Payrexx-Implementierung ergänzen
      (Gateway mit subscriptionState, Webhook mit X-Webhook-Signature HMAC-SHA256 hex, Status active/overdue/failed/cancelled/in_notice,
      Kundenportal via POST /AuthToken, Kündigen via DELETE /Subscription/{id}); Tests gegen dokumentierte Payloads
- [ ] Diese App auf Payrexx umstellen (Env: PAYREXX_INSTANCE, PAYREXX_API_SECRET, PAYREXX_WEBHOOK_SECRET), Checkout und Kündigung einmal im Testmodus durchspielen
- [ ] Datenschutzerklärung: Stripe durch Payrexx AG, Thun ersetzen

## Abo-Modell (Code steht, Konto fehlt)

- [ ] Settings: "Abo verwalten"-Button (`POST /billing/portal`) für zahlende Nutzer ergänzen (Endpoint existiert).
- [ ] Nach Rückkehr von Stripe (`/settings?checkout=success`) Nutzung neu laden und Toast zeigen.
- [ ] Limit-Meldung im Chat mit Link zu den Einstellungen statt nur Text.
