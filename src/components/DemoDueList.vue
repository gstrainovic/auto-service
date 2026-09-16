<script setup lang="ts">
import Badge from 'primevue/badge'

// Gerenderte Beispiel-Ansicht der Fälligkeitsliste für Landing Pages: gleiche Farben, Icons und Badges wie im Dashboard,
// aber feste Daten ohne Store. «compact» zeigt nur Bezeichnung und Badge.
withDefaults(defineProps<{ compact?: boolean, vehicle?: string }>(), {
  compact: false,
  vehicle: 'VW Caddy · SG 48 213',
})

const rows = [
  { label: 'Ölwechsel', caption: 'nächste am 14.03.2027 oder bei 92\'000 km', status: 'OK', severity: 'success', icon: 'pi pi-check-circle', color: 'var(--p-green-500)' },
  { label: 'Bremsen', caption: 'fällig am 05.10.2026', status: 'Bald fällig', severity: 'warn', icon: 'pi pi-clock', color: 'var(--p-yellow-500)' },
  { label: 'MFK', caption: 'fällig seit 01.08.2026', status: 'Überfällig', severity: 'danger', icon: 'pi pi-exclamation-triangle', color: 'var(--p-red-500)' },
] as const
</script>

<template>
  <div class="demo-due" :class="{ 'demo-due-compact': compact }" aria-label="Beispiel: Fälligkeiten eines Fahrzeugs">
    <div v-if="!compact" class="demo-due-head">
      <i class="pi pi-car" />
      <span>{{ vehicle }}</span>
      <Badge value="1 überfällig" severity="danger" />
    </div>
    <div v-for="row in rows" :key="row.label" class="demo-due-row">
      <i :class="row.icon" :style="{ color: row.color }" />
      <div class="demo-due-text">
        <div class="demo-due-label">
          {{ row.label }}
        </div>
        <div v-if="!compact" class="demo-due-caption">
          {{ row.caption }}
        </div>
      </div>
      <Badge :value="row.status" :severity="row.severity" />
    </div>
    <div v-if="!compact" class="demo-due-foot">
      Beispiel-Ansicht aus der Übersicht
    </div>
  </div>
</template>

<style scoped>
.demo-due {
  text-align: left;
  border-radius: var(--p-border-radius);
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.demo-due-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  font-weight: 600;
  border-bottom: 1px solid var(--p-surface-border);
}

.demo-due-head i {
  color: var(--p-primary-color);
}

.demo-due-head .p-badge {
  margin-left: auto;
}

.demo-due-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--p-surface-border);
}

.demo-due-row:last-of-type {
  border-bottom: none;
}

.demo-due-row > i {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.demo-due-text {
  flex: 1;
  min-width: 0;
}

.demo-due-label {
  font-weight: 500;
}

.demo-due-caption {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

.demo-due-foot {
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  background: var(--p-surface-ground);
  border-top: 1px solid var(--p-surface-border);
}

.demo-due-compact {
  box-shadow: none;
  margin-top: 1rem;
}

.demo-due-compact .demo-due-row {
  padding: 0.5rem 0.75rem;
  gap: 0.5rem;
}

.demo-due-compact .demo-due-row > i {
  font-size: 1rem;
}
</style>
