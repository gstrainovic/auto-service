#!/usr/bin/env bash
# Montiert aus den Clips in video-out/ die fertigen Filme: Sprecher (Piper, Stimme Thorsten), eingebrannte
# Untertitel und Titelkarten. Ergebnis sind public/film-*.webm für die Landing Pages und die kurzen Fassungen
# video-out/social-*.webm für Social und bezahlte Werbung.
#
#   npm run video           # Clips aufnehmen (Playwright)
#   scripts/video-build.sh  # Filme montieren
#
# Voraussetzungen: ffmpeg, und für den Sprecher piper mit der Stimme de_DE-thorsten-high
# (pipx install piper-tts, Stimme von huggingface.co/rhasspy/piper-voices). Fehlt piper, entsteht der Film
# stumm und ohne Untertitel — die Titelkarten tragen die Aussagen dann allein.
set -euo pipefail
cd "$(dirname "$0")/.."

CLIPS=video-out
OUT=public
STIMME="${PIPER_VOICE:-$HOME/.local/share/piper-voices/de_DE-thorsten-high.onnx}"
BREITE=585
HOEHE=1266
mkdir -p "$OUT"

if command -v piper >/dev/null && [ -f "$STIMME" ]; then
  SPRECHER=1
else
  SPRECHER=0
  echo "piper oder Stimme fehlt: Film wird stumm gebaut" >&2
fi

# Abschnitte: <Clip>|<Start in s>|<Mindestdauer in s>|<Sprechertext>|<Untertitel, optional>
# Der vierte Teil wird gesprochen, der fünfte steht im Bild; fehlt er, wird der Sprechertext angezeigt.
# Getrennt sind sie, wo die Schrift anders lauten muss als die Aussprache: espeak spricht «Serviceheft» als
# «Servi-keeft», «Serwis-Heft» trifft es. Prüfen mit: espeak-ng -v de -q -x "Wort"
# Die Dauer wächst automatisch, wenn der Sprecher länger braucht.
PRIVAT=(
  "szene-privat-zettelwirtschaft-in-der-schachtel|1.2|4.0|Wann war nochmal der letzte Ölwechsel? Irgendwo in der Schachtel."
  "titel-1-rechnung-fotografieren|0.6|3.0|Mit Wartungsheft fotografierst du die Werkstattrechnung."
  "szene-2-rechnung-fotografieren-felder-fuellen-sich|6.0|7.0|Werkstatt, Datum, Betrag, Kilometerstand und die Arbeiten stehen drin. Ohne Tippen."
  "titel-2-wartungsheft-rechnet-mit|0.6|3.0|Wartungsheft rechnet mit."
  "szene-3-faelligkeit-auf-dem-dashboard-und-erledigt-eintragen|1.5|6.0|Was fällig ist, meldet sich von selbst. Erledigtes trägst du mit einem Klick ein."
  "titel-3-lueckenloses-serviceheft|0.6|3.0|Und beim Verkauf?"
  "szene-4-kosten-und-pdf-dossier-fuer-den-verkauf|4.0|5.5|Kosten pro Jahr, und das lückenlose Serwis-Heft als PDF.|Kosten pro Jahr, und das lückenlose Serviceheft als PDF."
  "titel-4-preis-privat|0.6|3.6|Fünfundzwanzig Franken im Jahr, für bis zu fünf Fahrzeuge."
  "titel-6-abspann|0.6|3.6|Dreissig Tage gratis testen, auf wartungsheft punkt c h."
)

BETRIEB=(
  "szene-betrieb-welcher-bus-ist-ueberfaellig|1.2|4.0|Welcher Bus ist beim Service überfällig?"
  "szene-2-fuhrpark-auf-einen-blick-was-ist-faellig|1.5|5.5|Ein Blick auf die Übersicht: was ansteht, für jedes Fahrzeug."
  "titel-1-rechnung-fotografieren|0.6|3.0|Der Fahrer fotografiert die Werkstattrechnung."
  "szene-3-rechnung-vom-fahrer-ein-foto-genuegt|6.0|6.5|Erfasst ist sie damit auch. Werkstatt, Betrag, Kilometerstand und Arbeiten."
  "titel-3-lueckenloses-serviceheft|0.6|3.0|Am Jahresende?"
  "szene-4-kosten-pro-fahrzeug-und-jahr-export-fuer-die-buchhaltung|2.0|5.5|Kosten pro Fahrzeug, als Datei für die Buchhaltung."
  "titel-5-preis-betrieb|0.6|3.6|Sechsunddreissig Franken pro Fahrzeug und Jahr, Rechnung auf die Firma."
  "titel-6-abspann|0.6|3.6|Dreissig Tage gratis testen, auf wartungsheft punkt c h."
)

# Kurzfassungen für Social: Problem, Beweis, Angebot
SOCIAL_PRIVAT=(
  "szene-privat-zettelwirtschaft-in-der-schachtel|1.2|3.0|Wo ist die letzte Werkstattrechnung?"
  "szene-2-rechnung-fotografieren-felder-fuellen-sich|6.5|6.0|Fotografieren genügt. Alles steht drin."
  "titel-6-abspann|0.6|3.5|Dreissig Tage gratis testen, auf wartungsheft punkt c h."
)

SOCIAL_BETRIEB=(
  "szene-betrieb-welcher-bus-ist-ueberfaellig|1.2|3.0|Welcher Bus ist überfällig?"
  "szene-2-fuhrpark-auf-einen-blick-was-ist-faellig|2.0|5.0|Ein Blick, und du weisst es."
  "titel-5-preis-betrieb|0.6|3.5|Sechsunddreissig Franken pro Fahrzeug und Jahr."
)

dauer_von() {
  ffprobe -v error -show_entries format=duration -of csv=p=0 "$1" | cut -d. -f1-2
}

# Untertitel als SRT über die ganze Länge des Abschnitts; libass bricht lange Zeilen selbst um
srt_schreiben() {
  local datei="$1" text="$2" dauer="$3"
  local ende
  ende=$(printf '%02d:%02d:%06.3f' 0 0 "$dauer" | tr '.' ',')
  {
    echo "1"
    echo "00:00:00,000 --> $ende"
    echo "$text"
  } > "$datei"
}

bauen() {
  local ziel="$1"; shift
  local teile=("$@")
  local tmp; tmp=$(mktemp -d)
  local liste="$tmp/liste.txt"
  : > "$liste"

  local i=0
  for teil in "${teile[@]}"; do
    IFS='|' read -r name start minimum text untertitel <<< "$teil"
    [ -n "${untertitel:-}" ] || untertitel="$text"
    local quelle="$CLIPS/$name.webm"
    if [ ! -f "$quelle" ]; then
      echo "fehlt: $quelle (zuerst npm run video)" >&2
      exit 1
    fi

    local dauer="$minimum"
    local stimme=""
    if [ "$SPRECHER" = 1 ] && [ -n "$text" ]; then
      stimme="$tmp/$i.wav"
      echo "$text" | piper --model "$STIMME" --output_file "$stimme" >/dev/null 2>&1
      local gesprochen; gesprochen=$(dauer_von "$stimme")
      # etwas Luft am Ende, damit der Schnitt nicht auf dem letzten Laut sitzt
      dauer=$(echo "if ($gesprochen + 0.8 > $minimum) $gesprochen + 0.8 else $minimum" | bc -l)
    fi

    local filter="scale=$BREITE:$HOEHE,fps=30"
    # Titelkarten tragen ihren Text schon im Bild; alles andere bekommt Untertitel
    if [ "$SPRECHER" = 1 ] && [ -n "$text" ] && [[ "$name" != titel-* ]]; then
      local srt="$tmp/$i.srt"
      srt_schreiben "$srt" "$untertitel" "$dauer"
      filter="$filter,subtitles='$srt':force_style='FontName=DejaVu Sans,FontSize=${UT_GROESSE:-11},PrimaryColour=&H00FFFFFF,BackColour=&HA0000000,BorderStyle=4,Outline=0,Shadow=0,Alignment=2,MarginV=60'"
    fi
    filter="$filter,fade=in:0:8,fade=out:st=$(echo "$dauer - 0.4" | bc -l):d=0.4"

    local stueck; stueck=$(printf '%s/%03d.webm' "$tmp" "$i")
    if [ -n "$stimme" ]; then
      ffmpeg -loglevel error -y -ss "$start" -t "$dauer" -i "$quelle" -i "$stimme" \
        -vf "$filter" -af "adelay=300|300,apad" -t "$dauer" \
        -c:v libvpx-vp9 -crf 34 -b:v 0 -row-mt 1 -c:a libopus -b:a 64k "$stueck"
    else
      ffmpeg -loglevel error -y -ss "$start" -t "$dauer" -i "$quelle" \
        -f lavfi -t "$dauer" -i anullsrc=r=48000:cl=mono \
        -vf "$filter" -c:v libvpx-vp9 -crf 34 -b:v 0 -row-mt 1 -c:a libopus -b:a 64k "$stueck"
    fi
    echo "file '$stueck'" >> "$liste"
    i=$((i + 1))
  done

  ffmpeg -loglevel error -y -f concat -safe 0 -i "$liste" -c copy "$ziel"
  rm -rf "$tmp"
  echo "$ziel ($(du -h "$ziel" | cut -f1), $(dauer_von "$ziel" | cut -d. -f1) s)"
}

bauen "$OUT/film-privat.webm" "${PRIVAT[@]}"
bauen "$OUT/film-betrieb.webm" "${BETRIEB[@]}"
# Dieselben Abschnitte aus den Desktop-Aufnahmen: Clipname plus -desktop
desktop_liste() {
  local -n quelle=$1
  local -n ziel=$2
  ziel=()
  local teil
  for teil in "${quelle[@]}"; do
    ziel+=("${teil/|/-desktop|}")
  done
}

BREITE_DESKTOP=1280
HOEHE_DESKTOP=720

bauen "$CLIPS/social-privat.webm" "${SOCIAL_PRIVAT[@]}"
bauen "$CLIPS/social-betrieb.webm" "${SOCIAL_BETRIEB[@]}"

# Standbild als Poster, sonst zeigt der Player vor dem Start eine schwarze Fläche
poster() {
  ffmpeg -loglevel error -y -ss "${2:-12}" -i "$1" -frames:v 1 -q:v 4 "${1%.webm}-poster.jpg"
  echo "${1%.webm}-poster.jpg"
}

desktop_liste PRIVAT PRIVAT_DESKTOP
desktop_liste BETRIEB BETRIEB_DESKTOP
BREITE=$BREITE_DESKTOP
HOEHE=$HOEHE_DESKTOP
UT_GROESSE=17
bauen "$OUT/film-privat-desktop.webm" "${PRIVAT_DESKTOP[@]}"
bauen "$OUT/film-betrieb-desktop.webm" "${BETRIEB_DESKTOP[@]}"

for film in "$OUT/film-privat.webm" "$OUT/film-betrieb.webm" "$OUT/film-privat-desktop.webm" "$OUT/film-betrieb-desktop.webm"; do
  poster "$film" 12
done
