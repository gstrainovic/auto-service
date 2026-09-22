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
# Länge der Überblendung zwischen zwei Abschnitten
BLENDE=0.45
# Sprechtempo: 1.0 ist Piper-Standard, höhere Werte sprechen langsamer. Zuschauer meldeten, sie kämen beim
# Lesen der Untertitel nicht mit.
TEMPO="${PIPER_TEMPO:-1.12}"
# Luft nach dem letzten Laut, bevor der Schnitt kommt
NACHLAUF=1.4
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
  "szene-privat-kaeufer-fragt-nach-dem-serviceheft|0.8|7.0|Du willst dein Auto verkaufen. Der Käufer fragt: Gibt es ein Serwis-Heft?|Du verkaufst dein Auto. Der Käufer fragt: «Gibt es ein Serviceheft?»"
  "szene-privat-zettelwirtschaft-in-der-schachtel|1.4|5.0|Und du suchst."
  "szene-2-rechnung-fotografieren-felder-fuellen-sich|6.0|8.5|Ab heute nicht mehr: Rechnung fotografieren genügt. Werkstatt, Datum, Betrag und Arbeiten stehen drin."
  "szene-3-faelligkeit-auf-dem-dashboard-und-erledigt-eintragen|1.5|7.5|Wartungsheft meldet sich, bevor die nächste Arbeit fällig ist."
  "szene-4-kosten-und-pdf-dossier-fuer-den-verkauf|4.0|7.0|Und beim Verkauf liegt alles auf dem Tisch: das vollständige Serwis-Heft als PDF.|Und beim Verkauf liegt alles auf dem Tisch: das vollständige Serviceheft als PDF."
  "szene-privat-kaeufer-bekommt-die-antwort|0.8|5.5|Alles da.|«Alles da.»"
  "titel-6-abspann|0.6|5.5|Fünfundzwanzig Franken im Jahr. Dreissig Tage gratis testen, auf wartungsheft punkt c h."
)

BETRIEB=(
  "szene-betrieb-montagmorgen-welcher-muss-zum-service|0.8|7.0|Montagmorgen im Betrieb. Welcher Lieferwagen muss zum Service?|Montagmorgen im Betrieb. Welcher Lieferwagen muss zum Service?"
  "szene-2-fuhrpark-auf-einen-blick-was-ist-faellig|1.5|7.5|Ein Blick auf die Übersicht: was ansteht, für jedes Fahrzeug."
  "szene-3-rechnung-vom-fahrer-ein-foto-genuegt|6.0|8.0|Der Fahrer fotografiert die Werkstattrechnung. Erfasst ist sie damit auch."
  "szene-4-kosten-pro-fahrzeug-und-jahr-export-fuer-die-buchhaltung|2.0|7.0|Am Jahresende: Kosten pro Fahrzeug, als Datei für die Buchhaltung."
  "szene-betrieb-auf-einen-blick-beantwortet|0.8|5.5|Und die Frage vom Montagmorgen beantwortet sich selbst."
  "titel-6-abspann|0.6|5.5|Sechsunddreissig Franken pro Fahrzeug und Jahr. Dreissig Tage gratis testen, auf wartungsheft punkt c h."
)

# Kurzfassungen für Social: Problem, Beweis, Angebot
SOCIAL_PRIVAT=(
  "szene-privat-zettelwirtschaft-in-der-schachtel|1.2|3.0|Wo ist die letzte Werkstattrechnung?"
  "szene-2-rechnung-fotografieren-felder-fuellen-sich|6.5|6.0|Fotografieren genügt. Alles steht drin."
  "titel-6-abspann|0.6|3.5|Dreissig Tage gratis testen, auf wartungsheft punkt c h."
)

SOCIAL_BETRIEB=(
  "szene-betrieb-montagmorgen-welcher-muss-zum-service|0.8|3.5|Welcher Lieferwagen muss zum Service?"
  "szene-2-fuhrpark-auf-einen-blick-was-ist-faellig|2.0|5.0|Ein Blick auf die Übersicht, und du weisst es."
  "titel-5-preis-betrieb|0.6|3.5|Sechsunddreissig Franken pro Fahrzeug und Jahr."
)

# Bumper für YouTube (höchstens 6 s, nicht überspringbar) und Instagram/Facebook: nur der Moment, in dem
# sich die Felder aus der fotografierten Rechnung füllen, dann die Abschlusskarte
SOCIAL_BUMPER=(
  "szene-2-rechnung-fotografieren-felder-fuellen-sich|9.8|3.8|Rechnung fotografieren. Fertig."
  "titel-6-abspann|0.6|1.8|Dreissig Tage gratis."
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
      echo "$text" | piper --model "$STIMME" --length-scale "$TEMPO" --output_file "$stimme" >/dev/null 2>&1
      local gesprochen; gesprochen=$(dauer_von "$stimme")
      # Luft am Ende, damit der Schnitt nicht auf dem letzten Laut sitzt und das Bild nachwirken kann
      dauer=$(printf '%.3f' "$(echo "if ($gesprochen + $NACHLAUF > $minimum) $gesprochen + $NACHLAUF else $minimum" | bc -l)")
    fi

    # Im Desktop-Layout laufen dieselben Szenen kürzer ab. Passt der Ausschnitt nicht in den Clip, rückt der
    # Start nach vorn; reicht der Clip trotzdem nicht, friert das letzte Bild ein statt abzuschneiden.
    local vorhanden; vorhanden=$(dauer_von "$quelle")
    local spielraum; spielraum=$(echo "$vorhanden - $dauer" | bc -l)
    if [ "$(echo "$start > $spielraum" | bc -l)" = 1 ]; then
      start=$(printf '%.3f' "$(echo "if ($spielraum > 0) $spielraum else 0" | bc -l)")
    fi
    local fehlt; fehlt=$(printf '%.3f' "$(echo "$dauer - ($vorhanden - $start)" | bc -l)")

    local filter="scale=$BREITE:$HOEHE,fps=30"
    if [ "$(echo "$fehlt > 0.05" | bc -l)" = 1 ]; then
      filter="$filter,tpad=stop_mode=clone:stop_duration=$fehlt"
    fi
    # Titelkarten tragen ihren Text schon im Bild; alles andere bekommt Untertitel
    if [ "$SPRECHER" = 1 ] && [ -n "$text" ] && [[ "$name" != titel-* ]]; then
      local srt="$tmp/$i.srt"
      srt_schreiben "$srt" "$untertitel" "$dauer"
      filter="$filter,subtitles='$srt':force_style='FontName=DejaVu Sans,FontSize=${UT_GROESSE:-11},PrimaryColour=&H00FFFFFF,BackColour=&HA0000000,BorderStyle=4,Outline=0,Shadow=0,Alignment=2,MarginV=60'"
    fi
    # Ein- und Ausblenden übernimmt der Crossfade; nur der Filmanfang blendet selbst auf
    [ "$i" = 0 ] && filter="$filter,fade=in:0:10"

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

  # Alle Stücke in einem Durchgang überblenden: Bild mit xfade, Ton mit acrossfade
  local eingaben=() vgraph="" agraph="" offset=0 n=0 vorher_v="[0:v]" vorher_a="[0:a]" stueck k
  for stueck in "$tmp"/[0-9][0-9][0-9].webm; do
    eingaben+=(-i "$stueck")
    n=$((n + 1))
  done
  offset=$(dauer_von "$tmp/000.webm")
  k=1
  while [ "$k" -lt "$n" ]; do
    local ziel_v="[v$k]" ziel_a="[a$k]"
    if [ "$k" = $((n - 1)) ]; then ziel_v="[vout]"; ziel_a="[aout]"; fi
    vgraph="$vgraph$vorher_v[$k:v]xfade=transition=fade:duration=$BLENDE:offset=$(printf '%.3f' "$(echo "$offset - $BLENDE" | bc -l)")$ziel_v;"
    agraph="$agraph$vorher_a[$k:a]acrossfade=d=$BLENDE:c1=tri:c2=tri$ziel_a;"
    offset=$(printf '%.3f' "$(echo "$offset + $(dauer_von "$(printf '%s/%03d.webm' "$tmp" "$k")") - $BLENDE" | bc -l)")
    vorher_v="$ziel_v"
    vorher_a="$ziel_a"
    k=$((k + 1))
  done
  ffmpeg -loglevel error -y "${eingaben[@]}" \
    -filter_complex "${vgraph}${agraph}" -map "[vout]" -map "[aout]" \
    -c:v libvpx-vp9 -crf 34 -b:v 0 -row-mt 1 -c:a libopus -b:a 64k "$ziel"
  rm -rf "$tmp"
  echo "$ziel ($(du -h "$ziel" | cut -f1), $(dauer_von "$ziel" | cut -d. -f1) s)"
}

kurzfassungen() {
  bauen "$CLIPS/social-privat.webm" "${SOCIAL_PRIVAT[@]}"
  bauen "$CLIPS/social-betrieb.webm" "${SOCIAL_BETRIEB[@]}"
  bauen "$CLIPS/bumper.webm" "${SOCIAL_BUMPER[@]}"
  # Meta und YouTube nehmen MP4 (H.264/AAC) am zuverlässigsten
  # -t 5.95: YouTube nimmt Bumper nur bis 6 s (6.001 zählt schon als länger), das Ende der Blende darf weg
  ffmpeg -loglevel error -y -i "$CLIPS/bumper.webm" -t 5.95 -c:v libopenh264 -pix_fmt yuv420p -b:v 2M -c:a aac -b:a 128k \
    -movflags +faststart "$CLIPS/bumper.mp4"
  echo "$CLIPS/bumper.mp4 ($(dauer_von "$CLIPS/bumper.mp4" | cut -d. -f1) s)"
}

# NUR_KURZ=1: nur Kurzfassungen und Bumper, ohne die langen Filme (Sekunden statt Minuten)
if [ "${NUR_KURZ:-0}" = 1 ]; then
  kurzfassungen
  exit 0
fi

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

kurzfassungen

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
