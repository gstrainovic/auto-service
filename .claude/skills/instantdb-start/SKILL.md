---
name: instantdb-start
description: InstantDB Server starten, stoppen und Status prüfen
disable-model-invocation: true
---

Verwalte den lokalen InstantDB Server.

## Starten
```bash
cd ~/instant/server && podman-compose -f docker-compose-dev.yml up -d
```

## Stoppen
```bash
cd ~/instant/server && podman-compose -f docker-compose-dev.yml down
```

## Status prüfen
```bash
podman ps | grep -E "postgres|server"
```

## PostgreSQL Debug-Zugriff
```bash
podman exec server_postgres_1 psql -U instant -d instant -c "SELECT * FROM apps;"
```

## Ports
- HTTP API: `localhost:8888` (via Vite-Proxy: `/instant-api`)
- WebSocket: `ws://localhost:8888/runtime/session`

## Troubleshooting
- Container nicht gefunden: `podman-compose` statt `docker-compose` auf Fedora
- App-ID: `cd7e6912-773b-4ee1-be18-4d95c3b20e9f`
