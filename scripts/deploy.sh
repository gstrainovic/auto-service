#!/usr/bin/env bash
# Deploy auf die Instanz: PWA bauen, Erinnerungs-Job bündeln, beides per rsync hochladen, Server-Checkout nachziehen.
# Voraussetzungen: SSH-Schlüssel für debian@195.15.207.47, Working Tree committed und gepusht (der Server macht git pull).
set -euo pipefail
cd "$(dirname "$0")/.."

HOST=debian@195.15.207.47
TARGET=/opt/auto-service

npm run build
npm run build:reminders
rsync -az --delete dist/ "$HOST:$TARGET/deploy/dist/"
rsync -az deploy/reminders.mjs "$HOST:$TARGET/deploy/reminders.mjs"
ssh "$HOST" "cd $TARGET && git pull -q && git log --oneline -n 1"
curl -fsS -o /dev/null -w 'app %{http_code}\n' https://wartungsheft.ch/dashboard
curl -fsS https://ai.wartungsheft.ch/health; echo
