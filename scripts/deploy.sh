#!/usr/bin/env bash
# Deploy auf die Instanz: PWA bauen, Erinnerungs- und Abo-Job bündeln, per rsync hochladen, Server-Checkout nachziehen.
# Voraussetzungen: SSH-Schlüssel für debian@195.15.207.47, Working Tree committed und gepusht (der Server macht git pull).
set -euo pipefail
cd "$(dirname "$0")/.."

HOST=debian@195.15.207.47
TARGET=/opt/auto-service

npm run build
npm run build:reminders
npm run build:billing
rsync -az --delete dist/ "$HOST:$TARGET/deploy/dist/"
rsync -az deploy/reminders.mjs deploy/billing.mjs "$HOST:$TARGET/deploy/"
ssh "$HOST" "cd $TARGET && git pull -q && git log --oneline -n 1"
curl -fsS -o /dev/null -w 'app %{http_code}\n' https://wartungsheft.ch/dashboard
curl -fsS https://ai.wartungsheft.ch/health; echo
