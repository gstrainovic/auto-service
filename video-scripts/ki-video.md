# Werbefilm zum Nulltarif: geprüfte Wege

Der Wunsch: zuerst ohne Geld probieren, ohne Wasserzeichen, kommerziell erlaubt. Geht — aber nicht mit allen
Vorschlägen, die im Netz kursieren. Unten steht, was der Prüfung standhält, was nicht, und ein Ablauf, der auf
diesem Laptop wirklich funktioniert. Kostenpflichtige Alternativen stehen in `ki-werkzeuge.md`.

Stand: 20.09.2026. Lizenzen ändern sich, vor dem nächsten Dreh nachprüfen.

## Bewertung der vorgeschlagenen Wege

| Vorschlag | Urteil | Begründung |
|---|---|---|
| **Wan 2.1 / 2.2** (Alibaba) | **Stimmt, aber nicht lokal auf diesem Rechner** | Apache 2.0, kommerziell frei, kein Wasserzeichen. Die Hardware reicht nicht: im Laptop steckt eine Quadro P1000 mit 4 GB VRAM. Die kleine Variante TI2V-5B will rund 8–10 GB, die 14B-Modelle deutlich mehr. Ausweg: Hugging-Face-Space oder eine geliehene GPU-Stunde |
| **TikTok Symphony / Meta Advantage+** | **Für uns untauglich** | Die Ausgabe ist an Werbekampagnen auf der jeweiligen Plattform gebunden, nicht frei für Website und andere Kanäle. Beide setzen ein aktives Werbekonto voraus |
| **Adobe Firefly Video gratis** | **Falsch** | Adobe erlaubt im Gratis-Tarif ausdrücklich nur persönliche, nicht-kommerzielle Nutzung, und die Ausgabe trägt ein Wasserzeichen. Kommerziell freigegeben sind erst die bezahlten Tarife (Standard 10 USD im Monat) |
| **CapCut als Schnittprogramm** | **Riskant, nicht nehmen** | ByteDance beschränkt die mitgelieferte Musik- und Asset-Bibliothek auf private Nutzung; ein Pro-Abo ist keine Musiklizenz. Dazu räumt man CapCut weitreichende Rechte an allem ein, was man hochlädt — bei einem eigenen Produktvideo unnötig. Shotcut oder Kdenlive tun dasselbe ohne diese Klauseln |

## Der Ablauf, der hier ohne Geld funktioniert

### 1. App-Aufnahmen: schon gelöst

`npm run video` spielt die echte App ab und zeichnet sie auf (`e2e/video/*.video.ts`), einmal im Handy-Layout und
einmal im Desktop-Layout. Kostet nichts, ist beliebig wiederholbar und zeigt die Software, wie sie wirklich aussieht.
Das ist der grösste Teil beider Filme.

### 2. Aussenszenen: gezeichnet statt gefilmt

Die Eröffnungsszenen sind **als SVG gezeichnet und mit CSS animiert**, in `video-scripts/szenen/`:
`privat-problem.html` (Zettel quellen aus der Schachtel, Fragezeichen) und `betrieb-problem.html` (vier
Transporter, einer meldet sich rot). Aufgenommen werden sie wie die App-Clips:

```bash
npm run video -- e2e/video/zeichnung.video.ts
scripts/video-clips.sh
```

Das kostet nichts, wirft keine Lizenzfrage auf, passt farblich zur App und ist nach einer Textänderung in
Sekunden neu aufgenommen. Weitere Szenen: HTML-Datei danebenlegen und in `e2e/video/zeichnung.video.ts`
eintragen.

Falls doch einmal ein fotorealistisches Bild gebraucht wird:

1. **Stock-Footage.** [Pexels](https://www.pexels.com/de-de/videos/) und [Pixabay](https://pixabay.com/de/videos/)
   geben ihre Clips unter eigener Lizenz frei: kommerzielle Nutzung erlaubt, keine Namensnennung nötig, kein
   Wasserzeichen. Suchbegriffe: «car repair receipt», «delivery vans yard», «mechanic workshop».
2. **Wan 2.2 über einen Hugging-Face-Space.** Gratis, Apache-2.0-Modell, Wartezeit je nach Andrang. Brauchbar für
   die ein, zwei Bilder, die weder gefilmt noch gefunden werden können.
3. **Geliehene GPU**, falls Wan lokal laufen soll: eine Stunde auf RunPod oder Thunder Compute kostet weniger als
   einen Franken. Streng genommen nicht mehr gratis, aber billiger als jedes Abo.

### 3. Stimme: lokal und frei, schon eingebaut

**Piper TTS** (MIT-Lizenz) mit der deutschen Stimme **Thorsten** (Datensatz CC0) läuft auf der CPU, ohne Konto und
ohne Netz. `scripts/video-build.sh` ruft es selbst auf: die Sprechertexte stehen dort je Abschnitt, die Länge des
Abschnitts wächst automatisch mit der Sprechdauer.

```bash
pipx install piper-tts
# Stimme nach ~/.local/share/piper-voices/ (rund 110 MB):
#   huggingface.co/rhasspy/piper-voices  →  de/de_DE/thorsten/high/de_DE-thorsten-high.onnx (+ .json)
```

Fehlt piper oder die Stimme, baut das Skript den Film stumm und ohne Untertitel; die Titelkarten tragen die
Aussagen dann allein. Qualität: gut verständlich, nüchterner als ElevenLabs — für einen Film über
Werkstattrechnungen passend. Andere Stimme: `PIPER_VOICE=/pfad/stimme.onnx scripts/video-build.sh`.

### 4. Untertitel: aus dem Sprechertext, nicht aus Whisper

Der Text steht ohnehin im Skript, also braucht es keine Spracherkennung: `video-build.sh` schreibt pro Abschnitt
eine SRT-Datei und brennt sie mit libass ein. Das ist exakt statt geraten und spart den Whisper-Schritt.

### 5. Musik: weglassen oder CC0

Keine KI-Musik für bezahlte Werbung, die Gründe stehen in `ki-werkzeuge.md` (GEMA-Urteil gegen Suno, gesperrte
Downloads bei Udio). Gratis und sauber: [Pixabay Music](https://pixabay.com/de/music/) und das
[Free Music Archive](https://freemusicarchive.org/) mit Filter auf CC0 oder CC-BY; bei CC-BY gehört die
Namensnennung in die Videobeschreibung. Am ruhigsten wirkt ohnehin: Sprecher plus ein, zwei echte Geräusche.

### 6. Schnitt: Shotcut oder Kdenlive

Beide gratis, quelloffen, auf Fedora installierbar, nehmen die WebM-Dateien aus `video-out/` direkt. Kein CapCut.

## Was das unterm Strich kostet

| Posten | Kosten |
|---|---|
| App-Aufnahmen (Playwright) | 0 |
| Gezeichnete Szenen (SVG im Repo) | 0 |
| Wan 2.2 über Hugging Face, falls nötig | 0, dafür Wartezeit |
| Sprecher (Piper, Stimme Thorsten) | 0 |
| Untertitel (Whisper) | 0 |
| Musik (CC0) oder keine | 0 |
| Schnitt (Shotcut) | 0 |

Ein kompletter Durchgang kostet also nichts ausser Zeit. Erst wenn der Film steht und die Stimme stört oder eine
Szene fehlt, lohnt sich Geld: ElevenLabs für einen Monat, oder ein paar Franken für Veo-Clips.

## Zwei Regeln, die auch bei der Gratis-Variante gelten

- **Die App wird nie generiert.** Nur echte Aufnahmen aus `npm run video`. Eine gemalte Oberfläche in der Werbung
  wäre irreführend.
- **Kennzeichnung**, sobald KI-Bilder oder eine KI-Stimme drin sind: ein Satz im Abspann oder in der Beschreibung.
