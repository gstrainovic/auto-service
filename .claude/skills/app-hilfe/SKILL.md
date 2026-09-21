---
name: app-hilfe
description: >
  Bedien- und Kommunikationsfunktionen der App: Diktieren, Rückmeldungen, Hilfeseite/Auffindbarkeit, Werbefilme und die Ablaufprüfung. Use when an Diktat (useDictation, transcribe), FeedbackDialog, /hilfe, SEO/llms.txt, Werbefilmen oder der Kernablauf-Prüfung vor einer Fertigmeldung gearbeitet wird.
---

Aus der früheren CLAUDE.md hierher verschoben (21.09.2026), Wortlaut unverändert.

## Diktieren statt tippen

Ein Baustein für alle Stellen: `useDictation.ts` (Aufnahme) und `DictateButton.vue` (Mikrofon-Knopf, verschwindet
ohne Mikrofon). Der Proxy erkennt den Text unter `/me/transcribe` (`voxtral-mini-latest`, höchstens drei Minuten).
Eingebaut in der Chat-Eingabe (Text landet in der Zeile, abgeschickt wird von Hand), in der Beschreibung des
Wartungsformulars und als «Rechnung ansagen» im Rechnungsformular: dort geht das Diktat durch
`parseInvoiceFromSpeech` — dieselbe zweite Stufe wie beim Foto — und füllt über `scannedToFormFields` und
`fillEmptyFields` nur die leeren Felder.

Nicht für Kennzeichen, Beträge und Daten als Einzelfeld: dort verhört sich die Erkennung. In einem ganzen Satz
gesprochen trifft sie dieselben Angaben zuverlässig. Messwerte und Empfehlung je Anwendungsfall stehen in
`stt-vergleich.md`.

## Rückmeldungen aus der App

Menüpunkt «Fehler melden oder Wunsch» (`FeedbackDialog.vue`): Sprachnachricht (MediaRecorder), Textfeld und die
Adresse zum Kopieren — drei Wege, weil `mailto` auf dem Rechner oft kein Mailprogramm findet und Tippen auf der
Baustelle mühsam ist. Der Proxy (`/feedback`, `feedback.ts`) lässt die Aufnahme von Mistral transkribieren
(`voxtral-mini-latest` an `/v1/audio/transcriptions`, rund 0.003 $ pro Minute; Messwerte und Grenzen in
`stt-vergleich.md`: keine Nachkorrektur, keine Zahlen diktieren) und schickt Transkript plus Audio
über Resend an `info@wartungsheft.ch`, Antwortadresse ist der Kunde. Scheitert die Transkription, geht die
Aufnahme trotzdem raus. Ohne `RESEND_TOKEN` landet alles im Proxy-Log.

## Hilfe und Auffindbarkeit

`/hilfe` (`HilfePage.vue`, im Fuss verlinkt) erklärt die neun Kernabläufe in je ein paar Sätzen und beantwortet
die häufigen Fragen; dieselben Fragen stehen als `FAQPage` im Kopf des Dokuments. Keine Bedienvideos: sie
veralten mit jeder Änderung der Oberfläche. Steht ein Schritt nur in der Hilfe und nicht in der App, ist das
eine Lücke in der Oberfläche, kein fehlendes Handbuch.

Für Suchmaschinen und KI-Antworten: `index.html` trägt die Beschreibung und `SoftwareApplication` mit beiden
Preisen (aus `plans.ts` gespiegelt, bei Preisänderungen mitziehen), `public/robots.txt` erlaubt GPTBot,
ClaudeBot, PerplexityBot und Google-Extended ausdrücklich und nennt die Sitemap, `public/sitemap.xml` führt die
öffentlichen Seiten, `public/llms.txt` fasst Produkt, Preise, Grenzen und Seiten zusammen.
AGB, Datenschutz und Impressum gehören in keinen Index (sie ziehen Abmahnanwälte an): nicht in Sitemap und
`llms.txt`, Caddy schickt dort `X-Robots-Tag: noindex, nofollow`.
Google Search Console: Domain-Property `wartungsheft.ch`, verifiziert per TXT-Eintrag im Infomaniak-Manager
(DNS-Zone). Neue Seiten dort über die URL-Prüfung zur Indexierung anmelden.

## Werbefilme

Die Filme auf den Landing Pages entstehen im Repo: `npm run video` nimmt die Szenen auf (Handy- und
Desktop-Layout), `scripts/video-build.sh` montiert sie samt Sprecher und Untertiteln nach `public/`.
Ablauf, Drehbücher, Wortwahl und Fallstricke: Skill `.claude/skills/werbefilm/SKILL.md`.

## Abläufe prüfen, nicht nur Seiten

Lücken wie «der Chat liest den Fahrzeugausweis, das Formular nicht» sieht man auf keiner einzelnen Seite. Vor einer
Fertigmeldung bei Änderungen an Formularen, Chat-Tools oder Navigation die betroffenen Kernabläufe durchgehen und
prüfen, ob jeder Einstieg (Dashboard, Fahrzeugliste, Fahrzeugseite, Formular, Chat, E-Mail-Link, Handy) dasselbe kann:

1. Neues Fahrzeug erfassen (leeres Dashboard und weiteres Fahrzeug)
2. Erste Rechnung und alte Belege nachtragen (Foto, mehrere Fotos, Sammel-PDF)
3. Wartung ohne Rechnung eintragen
4. Serviceheft-Intervalle hinterlegen und Fälligkeiten verstehen
5. Kosten exportieren (ein Fahrzeug, alle Fahrzeuge)
6. Erinnerung erhalten und Arbeit als erledigt eintragen
7. Fahrzeug verkaufen oder abgeben
8. Kilometerstand aktuell halten
9. Betrieb: über alle Fahrzeuge sehen, was fällig ist

KI-Funktionen zusätzlich mit echtem Material testen, nicht nur mit Mocks: Fotos und PDF in `tmp/` (lokal),
Fahrzeugausweis in `e2e/fixtures/`, `npx playwright test e2e/invoice-scan-real.spec.ts --project=ai-soft`.
