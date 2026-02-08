/**
 * Maintenance Type Definitions
 */

import type { MAINTENANCE_CATEGORIES } from '../services/ai'

export type MaintenanceCategory = typeof MAINTENANCE_CATEGORIES[number]
