/**
 * Form Type Definitions
 */

import type { MaintenanceCategory } from './maintenance'

export interface InvoiceFormItem {
  description: string
  category: MaintenanceCategory
  amount: number
}

export interface InvoiceFormData {
  date: string
  workshop?: string
  amount?: number
  currency?: 'EUR' | 'CHF'
  category?: MaintenanceCategory
  description?: string
  /** Kilometerstand bei der Rechnung; leer heisst unbekannt */
  mileage?: number
  /** Positionen aus dem Beleg-Scan; ersetzen Kategorie und Beschreibung */
  items?: InvoiceFormItem[]
  images?: string[]
}

export interface MaintenanceFormData {
  category: MaintenanceCategory
  date: string
  mileage?: number
  description?: string
  status?: 'done' | 'planned'
}

export interface FormErrors {
  [key: string]: string
}
