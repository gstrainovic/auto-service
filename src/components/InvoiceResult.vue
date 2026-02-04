<script setup lang="ts">
import type { ParsedInvoice } from '../services/ai'
import Button from 'primevue/button'

import Card from 'primevue/card'

defineProps<{ result: ParsedInvoice }>()
defineEmits<{ save: [], discard: [] }>()
</script>

<template>
  <Card class="mt-4">
    <template #title>
      Erkannte Daten
    </template>
    <template #content>
      <div class="field-group">
        <label class="field-label">Werkstatt</label>
        <div class="field-value">
          {{ result.workshopName }}
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">Datum</label>
        <div class="field-value">
          {{ result.date }}
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">Gesamtbetrag</label>
        <div class="field-value">
          {{ result.totalAmount?.toFixed(2) }} €
        </div>
      </div>
      <div v-if="result.mileageAtService" class="field-group">
        <label class="field-label">Kilometerstand</label>
        <div class="field-value">
          {{ result.mileageAtService?.toLocaleString('de-DE') }} km
        </div>
      </div>

      <div class="text-lg font-semibold mt-4 mb-2">
        Positionen
      </div>
      <ul class="item-list">
        <li v-for="(item, i) in result.items" :key="i" class="item-row">
          <div class="item-content">
            <div class="item-description">
              {{ item.description }}
            </div>
            <div class="item-category">
              {{ item.category }}
            </div>
          </div>
          <div class="item-amount">
            {{ item.amount.toFixed(2) }} €
          </div>
        </li>
      </ul>
    </template>
    <template #footer>
      <div class="flex gap-2">
        <Button label="Speichern" @click="$emit('save')" />
        <Button label="Verwerfen" text @click="$emit('discard')" />
      </div>
    </template>
  </Card>
</template>

<style scoped>
.field-group {
  margin-bottom: 0.75rem;
}

.field-label {
  display: block;
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  margin-bottom: 0.25rem;
}

.field-value {
  font-size: 1rem;
}

.item-list {
  list-style: none;
  padding: 0;
  margin: 0;
  border: 1px solid var(--p-content-border-color);
  border-radius: var(--p-border-radius);
}

.item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--p-content-border-color);
}

.item-row:last-child {
  border-bottom: none;
}

.item-content {
  flex: 1;
}

.item-description {
  font-weight: 500;
}

.item-category {
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}

.item-amount {
  font-weight: 500;
  white-space: nowrap;
  margin-left: 1rem;
}
</style>
