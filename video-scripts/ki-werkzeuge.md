# KI-Werkzeuge für die Werbefilme

Stand der Recherche: 20.09.2026. Preise und Rechtslage ändern sich schnell, vor dem nächsten Dreh nachprüfen.

Was **nicht** aus der KI kommt: die App-Aufnahmen. Die spielt Playwright echt ab (`e2e/video/*.video.ts`), damit
im Film die Software zu sehen ist und nicht eine erfundene Oberfläche. Werbung mit einer KI-gemalten App wäre
irreführend.

## Bewegtbild für die Aussenszenen

| Dienst | Kosten | Taugt für | Haken |
|---|---|---|---|
| **Google Veo 3.1** (über Gemini oder Google Flow) | ab etwa 0.15 USD pro Sekunde im Fast-Modus | Heldenbilder, 4K, Ton direkt mit | teurer als Kling, Google-Konto nötig |
| **Kling 3.0** | etwa 0.10 USD pro Sekunde, rund 0.50 USD pro Clip | viele Varianten ausprobieren | Qualität etwas unter Veo |
| ~~Sora 2~~ | – | – | **fällt weg**: App im April 2026 geschlossen, API endet am 24.09.2026 |

Empfehlung: die zwei bis drei Aussenszenen mit **Veo 3.1 Fast** erzeugen. Bei einem 70-Sekunden-Film sind das
etwa 15 Sekunden KI-Material, also ungefähr 2 bis 3 USD pro Durchgang. Varianten lieber mit Kling vorprobieren.

**Prompts (Deutsch schreiben geht, Englisch trifft meist besser):**

Szene 1 privat:
> Close-up, handheld: a cluttered shoebox full of crumpled car repair receipts on a kitchen table, a hand
> searching through them, warm evening light, Swiss apartment, photorealistic, shallow depth of field, no text,
> no logos, 9:16

Szene 6 privat:
> Medium shot: a person in a driveway next to a small hatchback, looking at a phone and smiling briefly, overcast
> Swiss suburb, natural colours, photorealistic, no brand logos, no readable license plate, 9:16

Szene 1 Betrieb:
> Wide shot: four white delivery vans parked on a small company yard in Switzerland, early morning, a tradesperson
> in work clothes walking past with a folder, overcast light, photorealistic, no brand logos, no readable license
> plates, 16:9

Regeln für die Prompts: keine Markenlogos, keine lesbaren Kennzeichen, keine erkennbaren realen Personen, keine
Nachbildung bekannter Gesichter.

## Sprecher

| Dienst | Kosten | Kommerzielle Nutzung |
|---|---|---|
| **ElevenLabs Creator** | 22 USD im Monat (rund 100 Minuten) | im Tarif enthalten, auch im Starter für 6 USD |
| **OpenAI TTS** (API) | ab etwa 0.015 USD pro 1000 Zeichen | deutlich günstiger, Qualität etwas darunter |

Für zwei Filme von je einer Minute reicht der kleinste kostenpflichtige Tarif; nach der Aufnahme kündbar. Deutsch
klingt bei ElevenLabs sehr natürlich. Einen Schweizer Einschlag gibt es nicht, also neutrales Hochdeutsch nehmen —
das passt zu einer Schweizer Marke besser als ein deutscher Werbeton.

Wichtig: keine Stimme klonen, die einer realen Person gehört, ohne deren Einwilligung.

## Musik

Hier ist Vorsicht angebracht, anders als bei Bild und Stimme:

- Das Landgericht München I gab der GEMA am 31.07.2026 gegen **Suno** weitgehend recht; Suno darf geschützte
  Werke nicht ohne Lizenz vervielfältigen. Seit den AGB vom 03.09.2026 gilt die kommerzielle Nutzung zudem nur
  für Downloads im monatlichen Kontingent über einen freigegebenen Kanal.
- **Udio** hat nach der Einigung mit Universal Music im Oktober 2025 Downloads und kommerzielle Nutzung gesperrt.

Für Werbung, die Geld kostet und öffentlich läuft, ist das zu wacklig. Zwei saubere Wege:

1. **Stockmusik mit klarer Lizenz** (Epidemic Sound, Artlist, Soundstripe): rund 10 bis 20 CHF im Monat, Lizenz
   deckt Social und bezahlte Werbung ab, schriftlich nachweisbar.
2. **Gar keine Musik.** Ein ruhiger Sprecher plus dezente Geräusche (Blättern, Kamera-Auslöser, Blinker) wirkt bei
   einem Werkzeug für Handwerker oft glaubwürdiger als Musikbett.

Empfehlung: Weg 2 für die erste Fassung, Weg 1 wenn Musik gewünscht ist. Suno nur, wenn du das Restrisiko kennst
und bewusst trägst.

## Schnitt

Alles zusammensetzen in **Shotcut** oder **Kdenlive** (beide gratis, laufen auf Fedora). Ablauf: App-Clips aus
`video-out/` auf die Spur legen, KI-Clips davor und dahinter, Sprecherspur darunter, Untertitel fest einbrennen.

Die Aufnahmen aus Playwright sind WebM. `scripts/video-clips.sh` wandelt sie nach MP4, wenn ffmpeg einen
H.264-Encoder hat; das ffmpeg aus den Fedora-Paketen hat keinen, dann bleibt es bei WebM in VP9 — Shotcut und
Kdenlive nehmen das direkt.

## Kennzeichnung

Bild und Stimme sind KI-generiert. Ein Satz im Abspann oder in der Videobeschreibung genügt: «Bilder und Stimme
KI-generiert.» Das gehört auch deshalb hin, weil die Werbung sonst mit Aufnahmen wirbt, die es so nie gab.

## Kosten überschlagen

| Posten | Einmalig | Monatlich |
|---|---|---|
| Veo 3.1 Fast, etwa 15 Sekunden je Film, zwei Filme | rund 5 USD | – |
| ElevenLabs Starter oder Creator | – | 6 bis 22 USD, nach der Aufnahme kündbar |
| Stockmusik (optional) | – | 10 bis 20 CHF |
| Schnitt (Shotcut) | 0 | 0 |

Ein Durchgang für beide Filme kostet also etwa 15 bis 30 Franken plus deine Zeit.
