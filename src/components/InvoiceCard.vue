<script setup lang="ts">
import type { Invoice } from '../stores/invoices'
import CategoryBadge from './CategoryBadge.vue'
import DocumentPreview from './DocumentPreview.vue'

interface Props {
  invoice: Invoice
}

const props = defineProps<Props>()

const emit = defineEmits<{
  click: []
  edit: []
  delete: []
}>()

// Format amount with invoice's currency
const formattedAmount = props.invoice.totalAmount
  ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: props.invoice.currency || 'EUR' }).format(props.invoice.totalAmount)
  : '—'

// Format date
const formattedDate = props.invoice.date
  ? new Date(props.invoice.date).toLocaleDateString('de-DE')
  : '—'
</script>

<template>
  <div class="invoice-card" @click="emit('click')">
    <DocumentPreview
      :image-data="invoice.imageData"
      size="md"
      alt="Rechnung"
    />

    <div class="invoice-content">
      <div class="invoice-header">
        <span class="invoice-workshop">{{ invoice.workshopName || 'Unbekannte Werkstatt' }}</span>
        <span class="invoice-amount">{{ formattedAmount }}</span>
      </div>

      <div class="invoice-meta">
        <span class="invoice-date">
          <i class="pi pi-calendar" />
          {{ formattedDate }}
        </span>
        <CategoryBadge
          v-if="invoice.items?.[0]?.category"
          :category="invoice.items[0].category as any"
          size="sm"
        />
      </div>
    </div>

    <div class="invoice-actions" @click.stop>
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
.invoice-card {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--surface-section);
  border-radius: var(--radius-lg);
  border: 1px solid var(--surface-border);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.invoice-card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--p-primary-color);
}

.invoice-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.invoice-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--spacing-sm);
}

.invoice-workshop {
  font-weight: var(--font-semibold);
  font-size: var(--text-base);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.invoice-amount {
  font-weight: var(--font-bold);
  color: var(--p-primary-color);
  font-size: var(--text-lg);
  flex-shrink: 0;
}

.invoice-meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--text-sm);
  color: var(--p-text-muted-color);
}

.invoice-date {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.invoice-actions {
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
