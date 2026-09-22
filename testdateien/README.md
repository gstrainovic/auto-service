# Testdateien

Bilder und Dokumente zum Ausprobieren der App: in «+ Rechnung hinzufügen», im Chat, im Formular «Neues Fahrzeug»
oder unter «Serviceheft fotografieren» hochladen. Die E2E-Tests verwenden dieselben Dateien.

| Datei | Inhalt | Wo ausprobieren |
|---|---|---|
| `test-invoice.png` | Werkstattrechnung BMW 320d, 15.01.2025, 47'500 km, vier Positionen, Total 486.90 € | Rechnung hinzufügen, Chat |
| `test-invoice-landscape.png` | Dieselbe Rechnung, um 90° gedreht (Handyfoto quer) | Rechnung hinzufügen: Ausrichtung |
| `test-kaufvertrag.png` | Kaufvertrag VW Golf VIII, 38'500 km, keine Rechnung | Chat, Mehrfach-Upload |
| `test-service-heft.png` | Serviceheft VW Golf VIII mit Intervallen und drei Stempeln | Serviceheft fotografieren, Chat |
| `fahrzeugausweis-schweiz.jpg` | Schweizer Fahrzeugausweis (Beispiel von Wikimedia) | Neues Fahrzeug: Ausweis-Scan |
| `test-rechnung-ch.png` | Garage Meier AG, Skoda Octavia ZH 123456, 03.03.2025, 92'300 km, Positionen netto, MWST 8.1 %, Total CHF 606.45 | Rechnung hinzufügen: CHF, Differenz «Nicht zugeordnet / MwSt.» |
| `test-rechnung-ch.pdf` | Dieselbe Rechnung als PDF mit Textebene, wie sie per Mail kommt | Rechnung hinzufügen: PDF |
| `test-rechnungen-sammel.pdf` | Drei Seiten, zwei Rechnungen zum VW Golf BE 98765: Reifen Keller CHF 148.00 (28.10.2024) und Autohaus Berger CHF 1'395.55 über zwei Seiten, Reparaturdatum 14.04.2025 vor dem Rechnungsdatum | Rechnung hinzufügen: Prüfliste mit zwei Einträgen, Fortsetzungsseite |

Die PNG- und PDF-Dateien erzeugt `e2e/generate-fixture.ts`. Echte Belege
(Rechnungen, Serviceheft, 9-Seiten-PDF) liegen nur lokal in `tmp/` und sind gitignored, weil sie Personendaten
enthalten.

## Lizenzen

Fremde Bilder in diesem Ordner:

| Datei | Quelle | Urheber | Lizenz |
|---|---|---|---|
| `fahrzeugausweis-schweiz.jpg` | [Wikimedia Commons: Fahrzeugausweis Schweiz.jpg](https://commons.wikimedia.org/wiki/File:Fahrzeugausweis_Schweiz.jpg) | chdhesi0 | gemeinfrei (vom Urheber weltweit freigegeben) |
