/**
 * Form Type Definitions
 */

import type { MaintenanceCategory } from './maintenance'

export interface InvoiceFormData {
  date: string
  workshop?: string
  amount?: number
  currency?: 'EUR' | 'CHF'
  category?: MaintenanceCategory
  description?: string
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
