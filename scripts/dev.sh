#!/bin/bash
# Dev server with automatic InstantDB start
# Checks if InstantDB is running, starts it if not, then runs Vite

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

# Start Vite dev server
exec npx vite
