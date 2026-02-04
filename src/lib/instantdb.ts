/**
 * InstantDB Client für Self-Hosted Server
 *
 * Konfiguration für lokalen InstantDB-Server.
 * Server läuft auf http://localhost:8888 (via podman-compose)
 *
 * Schema: Schemaless - keine Schema-Definition nötig.
 * Daten werden dynamisch erstellt.
 *
 * Start Server: cd ~/instant/server && podman-compose -f docker-compose-dev.yml up -d
 */
import { id, init, tx as instantTx } from '@instantdb/core'

// Konfiguration für Self-Hosted InstantDB
// HTTP API: Proxy für CORS (Vite leitet /instant-api → localhost:8888)
// WebSocket: Direkt verbinden mit /runtime/session Pfad
const isDev = import.meta.env.DEV
const INSTANT_API_URI = isDev ? '/instant-api' : 'http://localhost:8888'
const INSTANT_WS_URI = 'ws://localhost:8888/runtime/session'

// App-ID für lokale Instanz (in PostgreSQL erstellt)
// podman exec server_postgres_1 psql -U instant -d instant -c "SELECT * FROM apps;"
const APP_ID = 'cd7e6912-773b-4ee1-be18-4d95c3b20e9f'

// InstantDB Client initialisieren
const db = init({
  appId: APP_ID,
  apiURI: INSTANT_API_URI,
  websocketURI: INSTANT_WS_URI,
  // Keine Datumskonvertierung (wir handhaben das selbst)
  useDateObjects: false,
  // DevTools deaktiviert - Toggle-Button blockiert UI-Klicks in Tests
  devtool: false,
})

// Typen für unsere Entitäten (schemaless, aber typisiert für IDE-Unterstützung)
export interface Vehicle {
  id: string
  make: string
  model: string
  year: number
  licensePlate: string
  mileage: number
  vin?: string
  customSchedule?: { type: string, label: string, intervalKm: number, intervalMonths: number }[]
  createdAt: number
}

export interface Invoice {
  id: string
  vehicleId: string
  workshopName?: string
  date: string
  totalAmount?: number
  currency?: string
  mileageAtService?: number
  imageData?: string
  ocrCacheId?: string
  items?: { description: string, category: string, amount: number }[]
  createdAt: number
}

export interface Maintenance {
  id: string
  vehicleId: string
  invoiceId?: string
  type: string
  description?: string
  doneAt: string
  mileageAtService: number
  nextDueDate?: string
  nextDueMileage?: number
  status?: string
  createdAt: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  attachments?: { type: string, name: string, preview?: string }[]
  createdAt: number
}

export interface OcrCache {
  id: string // Hash des Bildes
  markdown: string
  createdAt: number
}

// Typisierter tx-Wrapper für schemaless InstantDB

const tx = instantTx as any

// Expose for E2E testing (replaces old __rxdb pattern)
if (isDev) {
  ;(window as any).__instantdb = { db, tx, id }
}

// Export für Verwendung in der App
export { db, id, tx }
