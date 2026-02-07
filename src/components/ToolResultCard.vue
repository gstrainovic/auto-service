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

// Human-readable labels for known keys
const FIELD_LABELS: Record<string, string> = {
  make: 'Marke',
  model: 'Modell',
  year: 'Baujahr',
  mileage: 'Kilometerstand',
  licensePlate: 'Kennzeichen',
  vin: 'VIN',
  workshopName: 'Werkstatt',
  date: 'Datum',
  totalAmount: 'Betrag',
  currency: 'Währung',
  mileageAtService: 'km-Stand',
  type: 'Typ',
  description: 'Beschreibung',
  doneAt: 'Datum',
  message: 'Info',
  label: 'Bezeichnung',
  interval: 'Intervall',
  category: 'Kategorie',
  amount: 'Betrag',
}

// Keys to skip (internal IDs, arrays handled separately, redundant)
const SKIP_KEYS = new Set(['items', 'schedule', 'vehicleId', 'invoiceId', 'id', 'currency'])

const meta = TOOL_META[props.result.tool] ?? { icon: 'pi pi-check', label: 'Ergebnis' }

function summary(): string {
  const d = props.result.data
  if (d.make)
    return `${d.make} ${d.model ?? ''} ${d.year ? `(${d.year})` : ''}`.trim()
  if (d.workshopName)
    return `${d.workshopName} — ${d.totalAmount ?? ''} ${d.currency || 'EUR'}`.trim()
  if (d.schedule?.length)
    return `${d.schedule.length} Wartungsintervalle`
  if (d.type && d.description)
    return `${d.description}`
  if (d.message)
    return d.message.length > 50 ? `${d.message.slice(0, 50)}…` : d.message
  return meta.label
}

function fields(): { label: string, value: string }[] {
  const d = props.result.data
  const f: { label: string, value: string }[] = []
  for (const [key, val] of Object.entries(d)) {
    if (SKIP_KEYS.has(key) || val == null || val === '')
      continue
    if (typeof val === 'object')
      continue
    const label = FIELD_LABELS[key] || key
    let value = String(val)
    // Format known numeric fields
    if ((key === 'mileage' || key === 'mileageAtService') && !Number.isNaN(Number(val)))
      value = `${Number(val).toLocaleString('de-DE')} km`
    if (key === 'totalAmount' && d.currency)
      value = `${val} ${d.currency}`
    f.push({ label, value })
  }
  return f
}

function tableItems(): { description: string, amount: string }[] {
  const d = props.result.data
  if (!d.items?.length)
    return []
  return d.items.map((i: any) => ({
    description: i.description || Object.values(i).find(v => typeof v === 'string') || '',
    amount: i.amount ? `${i.amount}` : '',
  }))
}

function scheduleRows(): { label: string, interval: string }[] {
  const d = props.result.data
  if (!d.schedule?.length)
    return []
  return d.schedule.map((s: any) => ({
    label: s.label || s.type || s.description || 'Intervall',
    interval: s.interval || s.value || '',
  }))
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
    <div class="tool-card-body">
      <div v-if="fields().length" class="tool-card-fields">
        <div v-for="field in fields()" :key="field.label" class="tool-card-field">
          <span class="tool-card-label">{{ field.label }}</span>
          <span class="tool-card-value">{{ field.value }}</span>
        </div>
      </div>

      <table v-if="tableItems().length" class="tool-card-table">
        <thead>
          <tr>
            <th>Position</th>
            <th>Betrag</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, i) in tableItems()" :key="i">
            <td>{{ item.description }}</td>
            <td class="amount">
              {{ item.amount }}
            </td>
          </tr>
        </tbody>
      </table>

      <table v-if="scheduleRows().length" class="tool-card-table">
        <thead>
          <tr>
            <th>Wartung</th>
            <th>Intervall</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(s, i) in scheduleRows()" :key="i">
            <td>{{ s.label }}</td>
            <td>{{ s.interval }}</td>
          </tr>
        </tbody>
      </table>
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

.tool-card-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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

.tool-card-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

.tool-card-table th {
  text-align: left;
  font-weight: 600;
  padding: 0.3rem 0.4rem;
  border-bottom: 1px solid color-mix(in srgb, var(--p-text-color) 20%, transparent);
  color: var(--p-text-muted-color);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.tool-card-table td {
  padding: 0.25rem 0.4rem;
  border-bottom: 1px solid color-mix(in srgb, var(--p-text-color) 8%, transparent);
}

.tool-card-table .amount {
  text-align: right;
  white-space: nowrap;
  font-weight: 500;
}
</style>
