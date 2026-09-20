#!/usr/bin/env bash
# Aufgenommene Werbeclips einsammeln: benennt die WebM-Dateien aus test-results/ nach der Szene und wandelt
# sie mit ffmpeg nach MP4 (H.264), damit jedes Schnittprogramm sie frisst. Aufruf nach `npm run video`.
#
#   scripts/video-clips.sh            # nach video-out/
#   scripts/video-clips.sh /tmp/clips # anderes Ziel
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="${1:-video-out}"
mkdir -p "$OUT"

# Fedoras ffmpeg bringt kein libx264 mit; dann nimmt das Skript die GPU (VAAPI) und sonst VP9 in WebM.
if ffmpeg -hide_banner -encoders 2>/dev/null | grep -q ' libx264'; then
  ENCODE=(-c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p)
  EXT=mp4
elif [ -e /dev/dri/renderD128 ] && ffmpeg -hide_banner -encoders 2>/dev/null | grep -q ' h264_vaapi'; then
  ENCODE=(-vaapi_device /dev/dri/renderD128 -vf 'format=nv12,hwupload' -c:v h264_vaapi -qp 20)
  EXT=mp4
else
  ENCODE=(-c:v libvpx-vp9 -crf 28 -b:v 0 -row-mt 1)
  EXT=webm
fi

shopt -s nullglob
found=0
for dir in test-results/video-*; do
  [ -f "$dir/video.webm" ] || continue
  # Ordnername: video-<datei>.video.ts-<gekürzter Titel>-<hash>--<szene>-video  ->  <datei>-<szene>
  name=$(basename "$dir")
  name=${name#video-}
  name=${name%-video}
  name=$(echo "$name" \
    | sed -E 's/\.video\.ts-[^-]*-[a-f0-9]+-*/-/' \
    | sed -e 's/ä/ae/g; s/ö/oe/g; s/ü/ue/g; s/Ä/Ae/g; s/Ö/Oe/g; s/Ü/Ue/g; s/ß/ss/g' \
    | tr -c 'A-Za-z0-9_-' '-' \
    | sed -E 's/-+/-/g; s/^-+//; s/-+$//')
  ffmpeg -loglevel error -y -i "$dir/video.webm" "${ENCODE[@]}" "$OUT/$name.$EXT"
  echo "$OUT/$name.$EXT"
  found=$((found + 1))
done

if [ "$found" -eq 0 ]; then
  echo "Keine Aufnahmen in test-results/ gefunden. Zuerst: npm run video" >&2
  exit 1
fi
echo "$found Clip(s) in $OUT"
