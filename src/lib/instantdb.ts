/**
 * InstantDB Client
 *
 * Modi (siehe instant-config.ts): cloud (Default), local (E2E, localhost:8888, Auth-Bypass),
 * selfhosted (eigener Server, VITE_INSTANT_APP_ID / VITE_INSTANT_API_URI / VITE_INSTANT_WS_URI)
 *
 * Schema: Schemaless - keine Schema-Definition nötig.
 * Daten werden dynamisch erstellt.
 */
import { id, init, tx as instantTx } from '@instantdb/core'
import { resolveInstantConfig } from './instant-config'

const isDev = import.meta.env.DEV

export const instantConfig = resolveInstantConfig({
  VITE_INSTANTDB_MODE: import.meta.env.VITE_INSTANTDB_MODE,
  VITE_INSTANT_APP_ID: import.meta.env.VITE_INSTANT_APP_ID,
  VITE_INSTANT_API_URI: import.meta.env.VITE_INSTANT_API_URI,
  VITE_INSTANT_WS_URI: import.meta.env.VITE_INSTANT_WS_URI,
  DEV: isDev,
})

// InstantDB Client initialisieren
// cloud: Default-URIs (api.instantdb.com), local: Vite-Proxy + direkter WebSocket, selfhosted: eigene URIs
const db = init({
  appId: instantConfig.appId,
  ...(instantConfig.apiURI && { apiURI: instantConfig.apiURI }),
  ...(instantConfig.websocketURI && { websocketURI: instantConfig.websocketURI }),
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
