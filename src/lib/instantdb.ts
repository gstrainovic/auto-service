/**
 * InstantDB Client
 *
 * Cloud: instantdb.com (Default)
 * Self-Hosted: VITE_INSTANTDB_MODE=local für lokalen Server (localhost:8888)
 *
 * Schema: Schemaless - keine Schema-Definition nötig.
 * Daten werden dynamisch erstellt.
 */
import { id, init, tx as instantTx } from '@instantdb/core'

const isDev = import.meta.env.DEV
const isLocal = import.meta.env.VITE_INSTANTDB_MODE === 'local'

// Cloud App-ID (instantdb.com)
const CLOUD_APP_ID = '5d413a89-91ad-4a5a-ad71-d2df5fd81d88'
// Self-Hosted App-ID (lokaler Server, für E2E-Tests)
const LOCAL_APP_ID = 'cd7e6912-773b-4ee1-be18-4d95c3b20e9f'

const APP_ID = isLocal ? LOCAL_APP_ID : CLOUD_APP_ID

// InstantDB Client initialisieren
// Cloud: Default-URIs (api.instantdb.com + wss://api.instantdb.com)
// Local: Proxy + direkter WebSocket
const db = init({
  appId: APP_ID,
  ...(isLocal && {
    apiURI: isDev ? '/instant-api' : 'http://localhost:8888',
    websocketURI: 'ws://localhost:8888/runtime/session',
  }),
  useDateObjects: false,
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
