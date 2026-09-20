# Wartungsheft: Arbeitswissen für Agenten

Projektregeln und Architektur stehen in `CLAUDE.md`. Hier steht, was den Betrieb der Entwicklungsumgebung betrifft.

## Entwickeln ohne Docker: Dev-InstantDB auf Infomaniak per SSH-Tunnel

Alles im Repo spricht InstantDB nur über `localhost:8888` an (`instant-config.ts`, Vite-Proxy `/instant-api`, `scripts/dev.sh`,
Playwright, die Offline-Fixture). Darum reicht auf einem PC ohne Docker oder Podman ein SSH-Tunnel zu einer Dev-Instanz;
am Code ändert sich nichts.

- **Instanz** `wartungsheft-dev` im selben OpenStack-Projekt wie die Produktion (PCP-CTPZLR8, dc3-a, Flavor
  `a2-ram4-disk50-perf1`, Debian 13, Docker CE), Zugriff `ssh debian@195.15.207.253` mit dem Key `claude-laptop`.
  Security Group `default`: nur 22, 80 und 443 offen; der Stack bindet 8888 ausschliesslich auf `127.0.0.1`.
- **Stack** in `/opt/instant`: `docker-compose.dev.yml` (Postgres 17, MinIO, `ghcr.io/instantdb/server:latest` mit 2-GB-Heap,
  gleiche Images wie Produktion, ohne Caddy und Dashboard), Passwörter in `/opt/instant/.env`, AEAD-Schlüssel des
  Servers im Volume `instant_server_config` (`override.edn`, derselbe wie im lokalen Dev-Checkout, damit der Dump lesbar bleibt).
- **Daten**: Dump der lokalen Dev-Datenbank vom 18.09.2026, also dieselbe App `cd7e6912-773b-4ee1-be18-4d95c3b20e9f`
  (`LOCAL_APP_ID`) mit demselben Admin-Token wie in `.env`. Die E2E-Tests leeren die App vor jedem Test, Daten dort sind Wegwerfdaten.
- **Ablauf auf dem anderen PC** (braucht Node, Git, Playwright-Browser, den SSH-Key und `.env` aus der Mail an sich selbst):

  ```bash
  ssh -N -L 8888:localhost:8888 debian@195.15.207.253 &   # Tunnel, läuft im Hintergrund
  npm run dev          # dev.sh sieht «InstantDB already running», startet nur Vite und AI-Proxy
  npm run test:e2e     # Playwright übernimmt den laufenden Port 8888 (reuseExistingServer)
  ```

  Kein Podman, kein `~/instant`-Checkout nötig. Offline-Tests funktionieren, sie blockieren `localhost:8888` im Browser.
- **Stack bedienen** (auf der Instanz, in `/opt/instant`): `docker compose -f docker-compose.dev.yml --env-file .env ps|logs|restart server`.
  Nach `up -d` dauert es rund eine Minute, bis 8888 antwortet; `curl localhost:8888/health/system` muss `{"wal":"ok"}` liefern.
- **Kosten**: läuft sie, kostet sie wie die Produktion (rund 13 CHF im Monat mit IPv4). Wird sie länger nicht gebraucht:
  `openstack --os-cloud PCP-CTPZLR8-dc3-a server shelve wartungsheft-dev` (kein CPU/RAM/Disk mehr, nur Snapshot und IPv4,
  IP bleibt), zurück mit `server unshelve`, danach `up -d` läuft dank `restart: unless-stopped` von selbst.
  Der Kostenwächter `~/.local/bin/wartungsheft-cost-watch` rechnet geshelvte Instanzen ohne Compute, Limit 30 CHF.
- **Neu aufsetzen**: Dump der lokalen Dev-DB (`podman exec server_postgres_1 pg_dump -U instant -Fc instant > dev.dump`)
  nach `/opt/instant`, dann `pg_restore -U instant -d instant --no-owner < dev.dump` in den laufenden Postgres,
  `truncate attr_sketches, wal_aggregator_status, wal_logs` (abgeleitete Daten, sonst stirbt der Serverstart an
  Duplikaten, siehe README «Backup») und `delete from config where k = 'wal-errors'` (der Dump trägt sonst den
  WAL-Fehler eines längst toten Prozesses mit, `/health/system` bleibt dann auf `{"wal":"error"}`), dann `up -d`.
- **Nicht**: die Produktionsinstanz für Entwicklung mitnutzen. 4 GB RAM sind mit dem 2-GB-Heap der Produktion belegt,
  und ein zweiter Stack auf derselben Maschine gefährdet die Kundendaten.

## Bank und Zahlungseingänge: PostFinance

Geschäftskonto ist PostFinance. Auswahl, Marktvergleich und die technische Prüfung stehen in
`geschaeftskonten-vergleich.md`, die Feldbelegung von camt.054 dort im Abschnitt «camt.054: Felder für den eigenen
Zahlungsabgleich». Bankdokument als Kopie in `sgkb-cash-management-handbuch.pdf`.

- **Zahlungsabgleich ohne AbaNinja**: Die Jahresrechnungen für Betriebe tragen eine QR- oder SCOR-Referenz aus
  `invoiceReference` (ai-proxy `src/invoice.ts`). Dieselbe Referenz steht im camt.054 unter
  `RmtInf/Strd/CdtrRefInf/Ref` und ist der Schlüssel für `markInvoicePaid`. AbaNinja Basic (CHF 21/Mt.) wird dafür
  nicht gebraucht.
- **camt.054 einlesen**: Parser in ai-proxy `src/camt.ts` (`parseCamt054`, fast-xml-parser, reine Funktion),
  Zuordnung in `src/services/billing-job.ts` (`matchCredits`), Aufruf `billing.mjs camt <datei.xml> [--dry-run]`
  (README «8.»). Iteriert wird über `NtryDtls/TxDtls`, nicht über `Ntry`: ein Tag mit mehreren Zahlungen kommt als
  eine Sammelbuchung. Das Buchungsdatum steht als `Ntry/BookgDt/Dt` am Eintrag, nicht an der Zahlung.
  `markInvoicePaid` bucht nur den vollen Betrag und lehnt eine schon verbuchte `AcctSvcrRef` ab; der Endpunkt
  `/billing/paid` antwortet darauf mit 409, auf eine unbekannte Referenz mit 404.
- **Testen ohne Konto**: Die PostFinance-Testplattform (isotest.postfinance.ch) ist ohne Kundenbeziehung nutzbar und
  simuliert die ganze Kette von der QR-Rechnung bis zum camt.054. Neue Parser-Arbeit wird dort belegt, nicht am
  Produktivkonto. Fixtures: `ai-proxy/src/fixtures/camt054-postfinance-muster.xml` ist die echte Musterdatei von
  PostFinance (Gutschrift ohne Referenz), `camt054-qrr.xml` ist nachgebaut und wird durch eine Datei der
  Testplattform ersetzt, sobald eine vorliegt.
- **EBICS erst bei Menge**: Zu Beginn reicht der manuelle camt.054-Download im E-Banking. PostFinance spricht EBICS
  3.0 und 2.5; mit 2.5 läuft `node-ebics/node-ebics-client`, was zum Node-Stack passt.
