# Werbefilm Privathalter

Zielgruppe: Autobesitzer mit einem oder zwei Fahrzeugen, die Rechnungen im Handschuhfach sammeln.
Länge: 60–75 Sekunden für die Startseite und `/privathalter`, daraus ein Schnitt von 15 Sekunden für Ads.
Format: 9:16 fürs Handy (Social), zusätzlich 16:9 für die Website.

Die App-Aufnahmen entstehen mit `e2e/video/privat.video.ts`, siehe «Aufnahme» unten. Ändert sich die
Oberfläche, wird nur neu aufgenommen und geschnitten; die Sprechertexte bleiben, solange die Aussagen stimmen.

## Szenenplan

| Nr. | Zeit | Bild | Quelle | Text (Untertitel und Sprecher) |
|---|---|---|---|---|
| 1 | 0–5 s | Zettel quellen aus einer Schachtel, Fragezeichen | gezeichnet, `szenen/privat-problem.html` | «Wann war nochmal der letzte Ölwechsel?» |
| 2 | 5–20 s | Handy fotografiert eine Werkstattrechnung, Felder füllen sich von selbst, Positionen erscheinen | App, Szene 2 | «Rechnung fotografieren. Werkstatt, Datum, Betrag, Kilometerstand und die Arbeiten stehen drin — ohne Tippen.» |
| 3 | 20–35 s | Dashboard mit Fälligkeitsliste, «Erledigt eintragen» | App, Szene 3 | «Wartungsheft rechnet, was wann fällig ist. Du bekommst eine Mail, bevor es zu spät ist.» |
| 4 | 35–48 s | Tab «Kosten», Jahreszahlen, PDF-Dossier | App, Szene 4 | «Beim Verkauf zählt ein lückenloses Serviceheft. Ein Klick, und es liegt als PDF bereit.» |
| 5 | 48–58 s | Einstellungen mit Abo und Testzeit, Preis als Texteinblendung | App, Szene 5 | «25 Franken im Jahr für bis zu fünf Fahrzeuge. Keine Werbung. Daten in der Schweiz.» |
| 6 | 58–70 s | Startseite mit Knopf «30 Tage gratis testen» | KI-Clip oder App | «30 Tage gratis testen, ohne Kreditkarte. wartungsheft.ch» |

## Kurzfassung 15 Sekunden (Ads)

Szene 1 (3 s) → Szene 2 gekürzt (7 s) → Szene 6 (5 s). Ein Satz als Untertitel: «Rechnung fotografieren, fertig.
30 Tage gratis testen.»

## Aussagen, die belegt sind

Nur das behaupten, was der Film zeigt oder was im Produkt steht:

- Der Scan füllt Werkstatt, Datum, Betrag, Kilometerstand und Positionen aus einem Foto.
- Die App rechnet Fälligkeiten und schickt Erinnerungen per E-Mail.
- Export als CSV und PDF-Dossier pro Fahrzeug.
- Preis: 25 CHF im Jahr bis fünf Fahrzeuge (`plans.ts`), 30 Tage Testzeit mit allem (`trial.ts`), keine Kreditkarte nötig.
- Daten liegen in der Schweiz (Infomaniak), die KI-Verarbeitung läuft bei Mistral in Frankreich.

Nicht behaupten: Zeitersparnis in Stunden, Wiederverkaufswert in Franken, Kundenstimmen. Dafür gibt es keine Belege.

## Bild und Ton

- Untertitel fest einbrennen; Social läuft stumm.
- Erste drei Sekunden zeigen das Problem, nicht das Logo.
- Keine echten Kennzeichen, Namen oder Adressen. Die Aufnahmen nutzen erfundene Daten.
- Keine fremden Markenlogos im Bild (Fahrzeughersteller, Werkstattketten).
- Ein Hinweis «KI-generierte Bilder und Stimme» im Abspann oder in der Videobeschreibung.

## Aufnahme der App-Szenen

```bash
npm run video -- e2e/video/privat.video.ts   # spielt die Szenen, zeichnet sie auf
scripts/video-clips.sh                        # sammelt sie nach video-out/ und wandelt sie um
```

Aufgenommen wird im Handyformat 390 × 844 bei dreifacher Auflösung (1170 × 2532). Jede Szene ist ein eigener
Clip. Die Daten sind erfunden und werden bei jeder Aufnahme neu angelegt, also nie Kundendaten im Bild.

Für 16:9 den Clip im Schnitt auf eine Fläche legen (unscharfer Hintergrund oder Gerätemockup), nicht beschneiden.

## KI-Werkzeuge

Gratis zuerst: `video-scripts/ki-video.md` (selbst filmen, Pexels, Wan 2.2, Piper-Stimme, Whisper-Untertitel).
Mit Budget: `video-scripts/ki-werkzeuge.md`, dort stehen auch die Prompts für die Szenen 1 und 6.
