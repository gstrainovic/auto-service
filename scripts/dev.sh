#!/bin/bash
# Dev server with automatic InstantDB start
# Checks if InstantDB is running, starts it if not, then runs Vite

# Lokaler Modus wie in den E2E-Tests: Auth-Bypass im Frontend, der Proxy erkennt den Nutzer am Header
# x-user-id. Im Cloud-Modus (instantdb.com) kann der lokale Proxy das Token nicht prüfen, Scan und Chat
# antworten dann mit 401. Übersteuern: VITE_INSTANTDB_MODE=cloud npm run dev
export VITE_INSTANTDB_MODE="${VITE_INSTANTDB_MODE:-local}"

INSTANT_URL="http://localhost:8888"
INSTANT_DIR="$HOME/instant/server"
COMPOSE_FILE="docker-compose-dev.yml"
TIMEOUT=90  # InstantDB JVM cold start can take ~60s

# Check if InstantDB is reachable (TCP port open = enough to know it's starting)
if curl -sf "$INSTANT_URL" -o /dev/null --connect-timeout 2 2>/dev/null; then
  echo "✓ InstantDB already running"
else
  echo "→ Starting InstantDB..."
  if [ ! -d "$INSTANT_DIR" ]; then
    echo "✗ InstantDB not found at $INSTANT_DIR"
    echo "  Clone it: git clone ... ~/instant"
    exit 1
  fi
  podman-compose -f "$INSTANT_DIR/$COMPOSE_FILE" up -d 2>/dev/null
  echo "  Waiting for InstantDB (JVM cold start, up to ${TIMEOUT}s)..."
  for i in $(seq 1 "$TIMEOUT"); do
    if curl -sf "$INSTANT_URL" -o /dev/null --connect-timeout 2 2>/dev/null; then
      echo "✓ InstantDB ready (${i}s)"
      break
    fi
    if [ "$i" -eq "$TIMEOUT" ]; then
      echo "✗ InstantDB failed to start within ${TIMEOUT}s"
      echo "  Check logs: podman logs server_server_1"
      exit 1
    fi
    sleep 1
  done
fi

# AI-Proxy (Scan und Chat laufen nur über ihn). Burst-Limit hoch, damit ein später gestartetes
# Playwright den laufenden Proxy übernehmen kann, ohne dass Chat-Tests mit 429 scheitern.
PROXY_URL="http://localhost:8787/health"
if curl -sf "$PROXY_URL" -o /dev/null --connect-timeout 2 2>/dev/null; then
  echo "✓ AI-Proxy already running"
else
  echo "→ Starting AI-Proxy on :8787 (log: /tmp/ai-proxy-dev.log)"
  AI_PROXY_BURST_LIMIT=10000 npm run -s dev:proxy > /tmp/ai-proxy-dev.log 2>&1 &
  PROXY_PID=$!
  trap 'kill $PROXY_PID 2>/dev/null' EXIT
fi

# Start Vite dev server (kein exec, damit der trap den Proxy beim Beenden mitnimmt)
npx vite
