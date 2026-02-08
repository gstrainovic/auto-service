<script setup lang="ts">
import type { MaintenanceCategory } from '../types/maintenance'

interface Props {
  category: MaintenanceCategory
  size?: 'sm' | 'md'
}

const _props = withDefaults(defineProps<Props>(), {
  size: 'md',
})

// Icon mapping
const iconMap: Record<MaintenanceCategory, string> = {
  oelwechsel: 'pi-circle-fill',
  inspektion: 'pi-check-circle',
  bremsen: 'pi-stop-circle',
  reifen: 'pi-circle',
  luftfilter: 'pi-filter',
  zahnriemen: 'pi-sync',
  bremsflüssigkeit: 'pi-droplet',
  klimaanlage: 'pi-sun',
  tuev: 'pi-verified',
  karosserie: 'pi-car',
  fahrwerk: 'pi-cog',
  auspuff: 'pi-cloud',
  kuehlung: 'pi-th-large',
  autoglas: 'pi-window-maximize',
  elektrik: 'pi-bolt',
  sonstiges: 'pi-ellipsis-h',
}

// Color mapping
const colorMap: Record<MaintenanceCategory, string> = {
  oelwechsel: '#f59e0b',
  inspektion: '#10b981',
  bremsen: '#ef4444',
  reifen: '#6366f1',
  luftfilter: '#3b82f6',
  zahnriemen: '#8b5cf6',
  bremsflüssigkeit: '#ec4899',
  klimaanlage: '#14b8a6',
  tuev: '#22c55e',
  karosserie: '#64748b',
  fahrwerk: '#0891b2',
  auspuff: '#78350f',
  kuehlung: '#0ea5e9',
  autoglas: '#06b6d4',
  elektrik: '#eab308',
  sonstiges: '#9ca3af',
}

// Label mapping
const labelMap: Record<MaintenanceCategory, string> = {
  oelwechsel: 'Ölwechsel',
  inspektion: 'Inspektion',
  bremsen: 'Bremsen',
  reifen: 'Reifen',
  luftfilter: 'Luftfilter',
  zahnriemen: 'Zahnriemen',
  bremsflüssigkeit: 'Bremsflüssigkeit',
  klimaanlage: 'Klimaanlage',
  tuev: 'TÜV',
  karosserie: 'Karosserie',
  fahrwerk: 'Fahrwerk',
  auspuff: 'Auspuff',
  kuehlung: 'Kühlung',
  autoglas: 'Autoglas',
  elektrik: 'Elektrik',
  sonstiges: 'Sonstiges',
}
</script>

<template>
  <div
    class="category-badge" :class="[`category-badge--${size}`]"
    :style="{ '--badge-color': colorMap[category] }"
  >
    <i class="pi" :class="[iconMap[category]]" />
    <span>{{ labelMap[category] }}</span>
  </div>
</template>

<style scoped>
.category-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-full);
  font-weight: var(--font-medium);
  background: color-mix(in srgb, var(--badge-color) 15%, transparent);
  color: var(--badge-color);
  border: 1px solid color-mix(in srgb, var(--badge-color) 30%, transparent);
}

.category-badge--sm {
  font-size: var(--text-xs);
  padding: calc(var(--spacing-xs) * 0.5) var(--spacing-xs);
}

.category-badge--sm i {
  font-size: var(--text-xs);
}

.category-badge--md {
  font-size: var(--text-sm);
}

.category-badge--md i {
  font-size: var(--text-sm);
}
</style>
