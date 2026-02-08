<script setup lang="ts">
import type { Maintenance } from '../stores/maintenances'
import type { MaintenanceCategory } from '../types/maintenance'
import CategoryBadge from './CategoryBadge.vue'

interface Props {
  maintenance: Maintenance
}

const props = defineProps<Props>()

const emit = defineEmits<{
  click: []
  edit: []
  delete: []
}>()

// Format date
const formattedDate = props.maintenance.doneAt
  ? new Date(props.maintenance.doneAt).toLocaleDateString('de-DE')
  : '—'

// Format mileage
const formattedMileage = props.maintenance.mileageAtService
  ? `${props.maintenance.mileageAtService.toLocaleString('de-DE')} km`
  : '—'

// Get category from type (some maintenances use "type" field)
const category = (props.maintenance.type || 'sonstiges') as MaintenanceCategory

// Status badge
const statusMap = {
  done: { label: 'Erledigt', severity: 'success' },
  due: { label: 'Fällig', severity: 'warn' },
  overdue: { label: 'Überfällig', severity: 'danger' },
}
</script>

<template>
  <div class="maintenance-card" @click="emit('click')">
    <div class="maintenance-content">
      <div class="maintenance-header">
        <CategoryBadge :category="category" size="md" />
        <span
          v-if="maintenance.status && maintenance.status !== 'done'"
          class="status-badge" :class="[`status-badge--${statusMap[maintenance.status].severity}`]"
        >
          {{ statusMap[maintenance.status].label }}
        </span>
      </div>

      <div v-if="maintenance.description" class="maintenance-description">
        {{ maintenance.description }}
      </div>

      <div class="maintenance-meta">
        <span class="meta-item">
          <i class="pi pi-calendar" />
          {{ formattedDate }}
        </span>
        <span class="meta-item">
          <i class="pi pi-gauge" />
          {{ formattedMileage }}
        </span>
      </div>
    </div>

    <div class="maintenance-actions" @click.stop>
      <button
        v-tooltip.top="'Bearbeiten'"
        class="action-button"
        @click="emit('edit')"
      >
        <i class="pi pi-pencil" />
      </button>
      <button
        v-tooltip.top="'Löschen'"
        class="action-button action-button--danger"
        @click="emit('delete')"
      >
        <i class="pi pi-trash" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.maintenance-card {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--surface-section);
  border-radius: var(--radius-lg);
  border: 1px solid var(--surface-border);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.maintenance-card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--p-primary-color);
}

.maintenance-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.maintenance-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.status-badge {
  padding: calc(var(--spacing-xs) * 0.5) var(--spacing-sm);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.status-badge--success {
  background: color-mix(in srgb, var(--status-success) 15%, transparent);
  color: var(--status-success);
}

.status-badge--warn {
  background: color-mix(in srgb, var(--status-warning) 15%, transparent);
  color: var(--status-warning);
}

.status-badge--danger {
  background: color-mix(in srgb, var(--status-error) 15%, transparent);
  color: var(--status-error);
}

.maintenance-description {
  font-size: var(--text-sm);
  color: var(--p-text-color);
}

.maintenance-meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  font-size: var(--text-sm);
  color: var(--p-text-muted-color);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.maintenance-actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.action-button {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  color: var(--p-text-color);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-button:hover {
  background: var(--surface-ground);
  border-color: var(--p-primary-color);
  color: var(--p-primary-color);
}

.action-button--danger:hover {
  border-color: var(--status-error);
  color: var(--status-error);
}
</style>
