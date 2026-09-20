#!/usr/bin/env bash
# Montiert aus den Clips in video-out/ die fertigen Filme und legt sie als public/film-*.webm ab, damit die
# Landing Pages sie ausliefern. Reihenfolge und Länge je Abschnitt stehen unten; sie folgen den Drehbüchern in
# video-scripts/. Ohne Ton: die Filme laufen stumm auf der Seite, die Aussagen stehen als Titelkarten im Bild.
#
#   npm run video          # Clips aufnehmen (Playwright)
#   scripts/video-build.sh # Filme montieren
set -euo pipefail
cd "$(dirname "$0")/.."

CLIPS=video-out
OUT=public
mkdir -p "$OUT"

# Abschnitt: <Clip-Name ohne Endung>:<Sekunden ab Start>:<Dauer>
PRIVAT=(
  "szene-privat-zettelwirtschaft-in-der-schachtel:1.2:4.0"
  "titel-1-rechnung-fotografieren:0.6:3.4"
  "szene-2-rechnung-fotografieren-felder-fuellen-sich:6.0:7.0"
  "titel-2-wartungsheft-rechnet-mit:0.6:3.4"
  "szene-3-faelligkeit-auf-dem-dashboard-und-erledigt-eintragen:1.5:6.0"
  "titel-3-lueckenloses-serviceheft:0.6:3.4"
  "szene-4-kosten-und-pdf-dossier-fuer-den-verkauf:4.0:5.5"
  "titel-4-preis-privat:0.6:3.6"
  "titel-6-abspann:0.6:3.6"
)

BETRIEB=(
  "szene-betrieb-welcher-bus-ist-ueberfaellig:1.2:4.0"
  "szene-2-fuhrpark-auf-einen-blick-was-ist-faellig:1.5:5.5"
  "titel-1-rechnung-fotografieren:0.6:3.4"
  "szene-3-rechnung-vom-fahrer-ein-foto-genuegt:6.0:6.5"
  "titel-3-lueckenloses-serviceheft:0.6:3.4"
  "szene-4-kosten-pro-fahrzeug-und-jahr-export-fuer-die-buchhaltung:2.0:5.5"
  "titel-5-preis-betrieb:0.6:3.6"
  "titel-6-abspann:0.6:3.6"
)

# Halbe Auflösung reicht fürs Web und drückt die Datei auf wenige MB
BREITE=585
HOEHE=1266

bauen() {
  local ziel="$1"; shift
  local teile=("$@")
  local tmp; tmp=$(mktemp -d)
  local liste="$tmp/liste.txt"
  : > "$liste"

  local i=0
  for teil in "${teile[@]}"; do
    local name="${teil%%:*}"
    local rest="${teil#*:}"
    local start="${rest%%:*}"
    local dauer="${rest#*:}"
    local quelle="$CLIPS/$name.webm"
    if [ ! -f "$quelle" ]; then
      echo "fehlt: $quelle (zuerst npm run video)" >&2
      exit 1
    fi
    local stueck
    stueck=$(printf '%s/%03d.webm' "$tmp" "$i")
    # Jedes Stück gleich kodieren, sonst lässt es sich nicht ohne Neukodierung aneinanderhängen
    ffmpeg -loglevel error -y -ss "$start" -t "$dauer" -i "$quelle" \
      -vf "scale=$BREITE:$HOEHE,fps=30,fade=in:0:8,fade=out:st=$(echo "$dauer - 0.4" | bc):d=0.4" \
      -c:v libvpx-vp9 -crf 34 -b:v 0 -row-mt 1 -an "$stueck"
    echo "file '$stueck'" >> "$liste"
    i=$((i + 1))
  done

  ffmpeg -loglevel error -y -f concat -safe 0 -i "$liste" -c copy "$ziel"
  rm -rf "$tmp"
  echo "$ziel ($(du -h "$ziel" | cut -f1), $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$ziel" | cut -d. -f1) s)"
}

bauen "$OUT/film-privat.webm" "${PRIVAT[@]}"
bauen "$OUT/film-betrieb.webm" "${BETRIEB[@]}"
