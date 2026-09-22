---
name: werbefilm
description: Werbefilme für die Landing Pages neu aufnehmen, montieren und ausliefern (Playwright-Szenen, Piper-Sprecher, ffmpeg)
---

Die Filme auf `/`, `/privathalter` und `/betrieb` entstehen vollständig im Repo: keine Kamera, kein fremdes
Material, keine Lizenzfrage. Ändert sich die Oberfläche oder ein Satz, wird neu aufgenommen statt neu gefilmt.

## Ablauf in zwei Befehlen

```bash
npm run video            # nimmt alle Szenen auf, im Handy- und im Desktop-Layout (rund 5 Minuten)
scripts/video-build.sh   # montiert daraus die Filme nach public/ (rund 10 Minuten)
```

Danach liegen bereit:

| Datei | Zweck |
|---|---|
| `public/film-privat.webm`, `film-betrieb.webm` | Handyfassung, 9:16 |
| `public/film-*-desktop.webm` | Desktopfassung, 16:9, ab 760 px Bildschirmbreite |
| `public/film-*-poster.jpg` | Standbild vor dem Start |
| `video-out/social-*.webm` | Kurzfassungen für Social und Anzeigen |
| `video-out/social-*.mp4` | Dieselben Kurzfassungen als MP4 (H.264 über `libopenh264`, Fedora hat kein `libx264`) für Meta und YouTube |

Nur die Kurzfassungen neu montieren (Sekunden statt Minuten): `NUR_KURZ=1 scripts/video-build.sh`.

Rechnungen im Film: `musterRechnungFoto` (`e2e/video/szenen.ts`) rendert zur Aufnahmezeit ein Rechnungsbild mit genau
den Angaben, die der gemockte Scan einfüllt. Werkstätten heissen «Muster-…», nie wie eine echte Firma.

Ausliefern wie der Rest der App: `npm run deploy` (die Filme liegen in `public/` und wandern mit ins `dist/`).

## Wo was steht

| Thema | Datei |
|---|---|
| Drehbücher: Szenenplan, Sprechertexte, belegbare Aussagen, Wortwahl | `video-scripts/privat-video-script.md`, `betrieb-video-script.md` |
| Reihenfolge, Längen, Sprechertexte, Untertitel der Montage | `scripts/video-build.sh` (Felder `PRIVAT`, `BETRIEB`, `SOCIAL_*`) |
| App-Szenen (was die Aufnahme klickt und scrollt) | `e2e/video/privat.video.ts`, `betrieb.video.ts` |
| Gezeichnete Szenen und Titelkarten | `video-scripts/szenen/*.html` |
| Gemeinsame Bausteine der Aufnahme | `e2e/video/szenen.ts` |
| Einbindung auf der Seite | `src/components/LandingVideo.vue` |
| Gratis-Werkzeuge, Lizenzen, Alternativen | `video-scripts/ki-video.md`, `ki-werkzeuge.md` |

`video-out/` ist gitignored, `public/film-*` ist eingecheckt.

## Etwas ändern

- **Satz umformulieren:** Zeile in `scripts/video-build.sh` ändern, dann `scripts/video-build.sh`. Keine
  Neuaufnahme nötig, die Abschnittslänge wächst automatisch mit der Sprechdauer.
- **Andere Stelle der App zeigen:** Szene in `e2e/video/*.video.ts` anpassen, dann `npm run video` und montieren.
- **Neue gezeichnete Szene:** HTML nach `video-scripts/szenen/`, in `e2e/video/zeichnung.video.ts` eintragen,
  aufnehmen, in die Abschnittsliste aufnehmen.
- **Reihenfolge oder Tempo:** Felder in `video-build.sh`: `<Clip>|<Start>|<Mindestdauer>|<Sprechertext>|<Untertitel>`.
  Der fünfte Teil ist optional und nur nötig, wenn die Schrift anders lauten muss als die Aussprache.

## Sprecher

Piper mit der Stimme `de_DE-thorsten-high` (MIT bzw. CC0, lokal, gratis):

```bash
pipx install piper-tts
# Stimme nach ~/.local/share/piper-voices/ (rund 110 MB), von huggingface.co/rhasspy/piper-voices:
#   de/de_DE/thorsten/high/de_DE-thorsten-high.onnx  und  .onnx.json
```

Fehlt piper oder die Stimme, baut das Skript stumm weiter. Andere Stimme: `PIPER_VOICE=/pfad.onnx scripts/video-build.sh`.

**Aussprache immer prüfen**, bevor ein neuer Satz in den Film geht:

```bash
espeak-ng -v de -q -x "Serviceheft"   # z'Ervi:k,e:E2ft  → falsch
espeak-ng -v de -q -x "Serwis-Heft"   # z'ErvIsh'Eft     → richtig
```

Bekannte Fälle: «Serviceheft» → im Sprechertext «Serwis-Heft». «lückenlos» klingt bei dieser Stimme flach →
«vollständig». «Dashboard» wechselt mitten im Satz ins Englische → «Übersicht».

## Regeln für den Inhalt

- **Die App wird nie generiert.** Nur echte Aufnahmen; eine gemalte Oberfläche in der Werbung wäre irreführend.
- Nur behaupten, was der Film zeigt oder was in `plans.ts`, `trial.ts` und den AGB steht. Keine Zeitersparnis in
  Stunden, kein Wiederverkaufswert in Franken, keine erfundenen Kundenstimmen.
- Alle Daten in den Aufnahmen sind erfunden und entstehen bei jedem Lauf neu.
- Der Sprecher duzt wie die App. Figuren im Bild reden neutral, damit kein Sie/Du-Bruch entsteht.
- «Lieferwagen», nicht «Bus»: in der Schweiz ist ein Bus das Postauto.
- Dramaturgie: Frage am Anfang, dieselbe Szene am Ende mit der Antwort. Keine Funktionsliste.

## Fallstricke, die schon einmal Zeit gekostet haben

- **`video.saveAs` braucht eine geschlossene Seite.** `clipSpeichern` ruft deshalb `page.close()` davor, sonst
  läuft der Aufruf in den Test-Timeout.
- **Ohne `--force-device-scale-factor` füllt die Aufnahme nur einen Bruchteil des Rahmens.** Steht in
  `playwright.config.ts` bei beiden Video-Projekten.
- **Zu kurze Clips zeigen den Seitenaufbau.** Passt ein Ausschnitt nicht in den Clip, rückt `video-build.sh` den
  Start vor — bis auf null, und dann läuft das Laden der Seite im Bild, was wie ein doppelter Refresh aussieht.
  Danach friert das letzte Bild ein. Beides heisst: Szene in `e2e/video/*.video.ts` verlängern. Faustregel:
  Clip mindestens zwei Sekunden länger als `Start + Mindestdauer` der Abschnittsliste. Längen prüfen mit
  `ffprobe -v error -show_entries format=duration -of csv=p=0 video-out/<clip>.webm`.
- **`bc` schreibt Werte unter eins als `.58`**, ffmpeg versteht das nicht. Alle Zahlen laufen durch `printf '%.3f'`.
- **Die Szenen einer Geschichte müssen dieselben Daten zeigen.** Sonst meldet das Dashboard in einer Szene
  «nichts fällig», während der Film von einem überfälligen Fahrzeug erzählt.
- **Die Dateien `.video.ts` sind keine Tests** und laufen nicht in `online`/`offline` mit; sie hängen an den
  Projekten `video` und `video-desktop`.
