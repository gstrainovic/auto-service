<script setup lang="ts">
import type { ToolResult } from '../services/chat'
import Panel from 'primevue/panel'

const props = defineProps<{ result: ToolResult }>()

const TOOL_META: Record<string, { icon: string, label: string }> = {
  add_vehicle: { icon: 'pi pi-car', label: 'Fahrzeug' },
  add_invoice: { icon: 'pi pi-receipt', label: 'Rechnung' },
  add_maintenance: { icon: 'pi pi-wrench', label: 'Wartung' },
  set_maintenance_schedule: { icon: 'pi pi-calendar', label: 'Wartungsplan' },
  delete_vehicle: { icon: 'pi pi-trash', label: 'Gelöscht' },
  delete_invoice: { icon: 'pi pi-trash', label: 'Gelöscht' },
}

const meta = TOOL_META[props.result.tool] ?? { icon: 'pi pi-check', label: 'Ergebnis' }

function summary(): string {
  const d = props.result.data
  if (d.make)
    return `${d.make} ${d.model} (${d.year})`
  if (d.workshopName)
    return `${d.workshopName} — ${d.totalAmount} ${d.currency || 'EUR'}`
  if (d.schedule?.length)
    return `${d.schedule.length} Wartungsintervalle`
  if (d.type && d.description)
    return `${d.description}`
  return meta.label
}

function fields(): { label: string, value: string }[] {
  const d = props.result.data
  const f: { label: string, value: string }[] = []
  if (d.make)
    f.push({ label: 'Marke', value: d.make })
  if (d.model)
    f.push({ label: 'Modell', value: d.model })
  if (d.year)
    f.push({ label: 'Baujahr', value: String(d.year) })
  if (d.mileage)
    f.push({ label: 'Kilometerstand', value: `${Number(d.mileage).toLocaleString('de-DE')} km` })
  if (d.licensePlate)
    f.push({ label: 'Kennzeichen', value: d.licensePlate })
  if (d.vin)
    f.push({ label: 'VIN', value: d.vin })
  if (d.workshopName)
    f.push({ label: 'Werkstatt', value: d.workshopName })
  if (d.date)
    f.push({ label: 'Datum', value: d.date })
  if (d.totalAmount)
    f.push({ label: 'Betrag', value: `${d.totalAmount} ${d.currency || 'EUR'}` })
  if (d.mileageAtService)
    f.push({ label: 'km-Stand', value: `${Number(d.mileageAtService).toLocaleString('de-DE')} km` })
  if (d.type)
    f.push({ label: 'Typ', value: d.type })
  if (d.description && !d.make)
    f.push({ label: 'Beschreibung', value: d.description })
  if (d.doneAt)
    f.push({ label: 'Datum', value: d.doneAt })
  if (d.items?.length)
    f.push({ label: 'Positionen', value: d.items.map((i: any) => `${i.description} (${i.amount})`).join(', ') })
  if (d.schedule?.length) {
    for (const s of d.schedule)
      f.push({ label: s.label || s.type || 'Intervall', value: s.interval || s.description || '' })
  }
  return f
}
</script>

<template>
  <Panel toggleable collapsed class="tool-result-card">
    <template #header>
      <div class="tool-card-header">
        <i :class="meta.icon" />
        <span class="tool-card-summary">{{ summary() }}</span>
      </div>
    </template>
    <div class="tool-card-fields">
      <div v-for="field in fields()" :key="field.label" class="tool-card-field">
        <span class="tool-card-label">{{ field.label }}</span>
        <span class="tool-card-value">{{ field.value }}</span>
      </div>
    </div>
  </Panel>
</template>

<style scoped>
.tool-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 500;
}

.tool-card-summary {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tool-card-fields {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tool-card-field {
  display: flex;
  justify-content: space-between;
  padding: 0.2rem 0;
  font-size: 0.85rem;
}

.tool-card-label {
  color: var(--p-text-muted-color);
}

.tool-card-value {
  font-weight: 500;
  text-align: right;
}
</style>
