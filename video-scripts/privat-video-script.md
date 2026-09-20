# Werbefilm Privathalter

Zielgruppe: Autobesitzer mit einem oder zwei Fahrzeugen, die Rechnungen im Handschuhfach sammeln.
Länge: 60–75 Sekunden für die Startseite und `/privathalter`, daraus ein Schnitt von 15 Sekunden für Ads.
Format: 9:16 fürs Handy (Social), zusätzlich 16:9 für die Website.

Die App-Aufnahmen entstehen mit `e2e/video/privat.video.ts`, siehe «Aufnahme» unten. Ändert sich die
Oberfläche, wird nur neu aufgenommen und geschnitten; die Sprechertexte bleiben, solange die Aussagen stimmen.

## Szenenplan

Rahmenhandlung statt Funktionsliste: dieselbe Szene am Anfang und am Ende, einmal ohne und einmal mit Antwort.
Der Zuschauer ist der Held, Wartungsheft ist das Werkzeug dazwischen. Die Aussagen stehen als Untertitel über
der App, nicht mehr als Vollbild-Karten — die hielten den Film an.

| Nr. | Zeit | Bild | Quelle | Sprecher und Untertitel |
|---|---|---|---|---|
| 1 | 0–6 s | Käufer am Auto, Sprechblase, Fragezeichen beim Verkäufer | gezeichnet, `szenen/privat-kaeufer.html` | «Du willst dein Auto verkaufen. Der Käufer fragt: Gibt es ein Serviceheft?» |
| 2 | 4–8 s | Zettel quellen aus der Schachtel | gezeichnet, `szenen/privat-problem.html` | «Und du suchst.» |
| 3 | 8–18 s | Foto der Rechnung, Felder und Positionen füllen sich | App, Szene 2 | «Ab heute nicht mehr: Rechnung fotografieren genügt. Werkstatt, Datum, Betrag und Arbeiten stehen drin.» |
| 4 | 18–24 s | Fälligkeitsliste, «Erledigt eintragen» | App, Szene 3 | «Wartungsheft meldet sich, bevor die nächste Arbeit fällig ist.» |
| 5 | 24–29 s | Kosten pro Jahr, PDF-Dossier | App, Szene 4 | «Und beim Verkauf liegt alles auf dem Tisch: das vollständige Serviceheft als PDF.» |
| 6 | 29–33 s | Dieselbe Szene wie 1, Haken statt Fragezeichen | gezeichnet, `szenen/privat-kaeufer.html?antwort=1` | «Alles da.» |
| 7 | 33–37 s | Abspann | gezeichnet, `szenen/titel.html` | «25 Franken im Jahr. 30 Tage gratis testen, auf wartungsheft.ch» |

Zwischen den Abschnitten liegt eine Überblendung von 0,45 s (`BLENDE` in `scripts/video-build.sh`), keine harten
Schnitte.

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

## Wortwahl im Film

- Der Sprecher duzt, wie die App. Figuren im Bild siezen nicht und duzen nicht: die Sprechblase heisst «Gibt es
  ein Serviceheft?», damit kein Bruch entsteht.
- Was sich meldet, ist Wartungsheft, nicht das Auto.
- Aussprache prüfen mit `espeak-ng -v de -q -x "Wort"`. Bekannt: «Serviceheft» klingt falsch, im Sprechertext
  steht «Serwis-Heft»; «lückenlos» klingt bei dieser Stimme flach, deshalb «vollständig».

## Bild und Ton

- Untertitel fest einbrennen; Social läuft stumm.
- Erste drei Sekunden zeigen das Problem, nicht das Logo.
- Keine echten Kennzeichen, Namen oder Adressen. Die Aufnahmen nutzen erfundene Daten.
- Keine fremden Markenlogos im Bild (Fahrzeughersteller, Werkstattketten).
- Ein Hinweis «KI-generierte Bilder und Stimme» im Abspann oder in der Videobeschreibung.

## Fertigen Film bauen

```bash
npm run video              # alle Clips (App, Zeichnungen, Titelkarten)
scripts/video-build.sh     # montiert public/film-privat.webm und film-betrieb.webm
```

Reihenfolge und Länge je Abschnitt stehen in `scripts/video-build.sh`. Die Landing Pages binden die Dateien über
`LandingVideo.vue` ein, stumm und erst auf Klick.

## Aufnahme der App-Szenen

```bash
npm run video -- e2e/video/privat.video.ts   # spielt die Szenen, zeichnet sie auf
scripts/video-clips.sh                        # sammelt sie nach video-out/ und wandelt sie um
```

Aufgenommen wird zweimal: im Handyformat 390 × 844 (Video 1170 × 2532) und im Desktop-Layout 1280 × 720 (Video
1920 × 1080). Jede Szene ist ein eigener Clip, die Desktop-Clips tragen `-desktop` im Namen. Die Daten sind erfunden und werden bei jeder Aufnahme neu angelegt, also nie Kundendaten im Bild.

Die Seite zeigt ab 760 px die Desktop-Fassung, darunter die hochkant aufgenommene.

## KI-Werkzeuge

Gratis zuerst: `video-scripts/ki-video.md` (selbst filmen, Pexels, Wan 2.2, Piper-Stimme, Whisper-Untertitel).
Mit Budget: `video-scripts/ki-werkzeuge.md`, dort stehen auch die Prompts für die Szenen 1 und 6.
