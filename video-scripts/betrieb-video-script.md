# Werbefilm Betrieb

Zielgruppe: Kleinbetriebe mit drei bis zwanzig Fahrzeugen — Sanitär, Elektro, Gartenbau, Kurier.
Länge: 45–60 Sekunden für `/betrieb`, daraus ein Schnitt von 15 Sekunden für Ads.
Format: 16:9 für die Website, 9:16 für Social.

Die App-Aufnahmen entstehen mit `e2e/video/betrieb.video.ts`. Ändert sich die Oberfläche, wird neu aufgenommen.

## Szenenplan

Derselbe Bogen wie im Privatfilm: eine Frage am Anfang, dieselbe Szene am Ende mit der Antwort. Die Aussagen
laufen als Untertitel über der App, zwischen den Abschnitten liegt eine Überblendung von 0,45 s.

| Nr. | Zeit | Bild | Quelle | Sprecher und Untertitel |
|---|---|---|---|---|
| 1 | 0–6 s | Vier gleiche Lieferwagen, kein Status | gezeichnet, `szenen/betrieb-problem.html` | «Montagmorgen im Betrieb. Welcher Lieferwagen muss zum Service?» |
| 2 | 6–12 s | Übersicht mit Fälligkeiten über alle Fahrzeuge | App, Szene 2 | «Ein Blick auf die Übersicht: was ansteht, für jedes Fahrzeug.» |
| 3 | 12–19 s | Rechnung fotografieren, Felder füllen sich | App, Szene 3 | «Der Fahrer fotografiert die Werkstattrechnung. Erfasst ist sie damit auch.» |
| 4 | 19–25 s | Kosten pro Fahrzeug und Jahr, CSV | App, Szene 4 | «Am Jahresende: Kosten pro Fahrzeug, als Datei für die Buchhaltung.» |
| 5 | 25–29 s | Dieselben Lieferwagen, jetzt mit Status, einer rot | gezeichnet, `?antwort=1` | «Und die Frage vom Montagmorgen beantwortet sich selbst.» |
| 6 | 29–33 s | Abspann | gezeichnet, `szenen/titel.html` | «36 Franken pro Fahrzeug und Jahr. 30 Tage gratis testen.» |

Die Szenen der App führen dieselben vier Fahrzeuge und dieselben Wartungen; sonst meldet das Dashboard in einer
Szene «nichts fällig» und widerspricht der Rahmenhandlung.

## Kurzfassung 15 Sekunden (Ads)

Szene 1 (3 s) → Szene 2 (6 s) → Szene 5 gekürzt (6 s). Untertitel: «Fuhrpark im Griff. 36 Franken pro Fahrzeug
und Jahr. 30 Tage gratis.»

## Aussagen, die belegt sind

- Fälligkeiten über alle Fahrzeuge auf einer Seite, Erinnerung per E-Mail.
- Rechnung fotografieren genügt, der Scan füllt die Felder.
- Kosten pro Fahrzeug und Jahr als CSV und als PDF-Übersicht.
- Preis: 36 CHF pro Fahrzeug und Jahr (`plans.ts`), Rechnung mit Schweizer QR-Zahlteil, zahlbar in 30 Tagen,
  Kündigung bis zum Ablauf ohne Frist (`invoice-subscription.ts`, AGB).
- 30 Tage Testzeit mit allem, ohne Kreditkarte.

Nicht behaupten: eingesparte Werkstattkosten, Ausfallzeiten, Zahl der Kunden. Auch nichts über Fahrerzuordnung,
Tankbuch oder Buchhaltung — das kann die App bewusst nicht (`business-plan/03-produkt.md`, «Abgrenzung»).

## Wortwahl im Film

- «Lieferwagen», nicht «Bus»: in der Schweiz ist ein Bus das Postauto.
- Der Sprecher duzt, wie die App.
- Aussprache prüfen mit `espeak-ng -v de -q -x "Wort"`; «Serviceheft» wird im Sprechertext «Serwis-Heft»
  geschrieben.

## Bild und Ton

- Ton nüchtern, kein Start-up-Sprech. Zielgruppe ist der Inhaber, der abends den Papierkram macht.
- Untertitel fest einbrennen.
- Keine echten Firmennamen, Kennzeichen oder Logos; die Aufnahmen nutzen erfundene Betriebe.
- Hinweis «KI-generierte Bilder und Stimme» im Abspann oder in der Beschreibung.

## Aufnahme der App-Szenen

```bash
npm run video -- e2e/video/betrieb.video.ts
scripts/video-clips.sh
```

Szene 5 zeigt den Bestelldialog nur, wenn der lokale AI-Proxy die Rechnungsstellung kennt. Beim Aufnehmen über
`npm run video` ist das der Fall (Test-IBAN in `playwright.config.ts`).

## KI-Werkzeuge

Gratis zuerst: `video-scripts/ki-video.md`. Mit Budget und den Prompts für Szene 1: `video-scripts/ki-werkzeuge.md`.
