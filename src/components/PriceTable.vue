<script setup lang="ts">
/**
 * Die eine Preisliste, für Private und Betriebe gleich: Tabelle mit typischen Flottengrössen und ein Regler für
 * die eigene Anzahl. Rechnet mit yearlyPriceChf aus dem Plan-Katalog, damit Seite und Abrechnung nie auseinanderlaufen.
 */
import { FIRST_VEHICLE_CHF, FURTHER_VEHICLE_CHF, yearlyPriceChf } from '@strainovic/ai-proxy/plans'
import Slider from 'primevue/slider'
import { computed, ref } from 'vue'
import { formatCurrency, formatNumber } from '../lib/locale'

const props = withDefaults(defineProps<{
  /** Startwert des Reglers: Private 1, Betriebe 5 */
  vehicles?: number
  /** kompakt: ohne Einleitungssatz, für die Angebotsseiten */
  compact?: boolean
  /** Obergrenze des Reglers: Privathalter 5, sonst 25 */
  max?: number
}>(), { vehicles: 1, compact: false, max: 25 })

const count = ref(props.vehicles)
const MAX = props.max
// Privathalter sehen nur die kleinen Stufen, Betriebe die ganze Staffel
const ROWS = [1, 3, 5, 10, 25].filter(n => n <= props.max)

const yearly = computed(() => yearlyPriceChf(count.value))
const monthly = computed(() => yearly.value / 12)
const perVehicle = computed(() => yearly.value / count.value / 12)

function chf(value: number): string {
  return formatCurrency(Math.round(value * 100) / 100)
}
</script>

<template>
  <div class="price-table" data-testid="price-table">
    <p v-if="!compact" class="price-intro">
      Eine Liste für alle: <strong>{{ formatNumber(FIRST_VEHICLE_CHF) }} CHF im Jahr</strong> für das erste Fahrzeug,
      jedes weitere <strong>{{ formatNumber(FURTHER_VEHICLE_CHF) }} CHF</strong>. Je mehr Fahrzeuge, desto günstiger pro Stück.
      30 Tage gratis testen, mit allem; danach brauchen nur KI-Scan und Chat das Abo.
    </p>

    <table class="price-grid" aria-label="Preisliste">
      <thead>
        <tr>
          <th>Fahrzeuge</th>
          <th class="num">
            pro Jahr
          </th>
          <th class="num">
            pro Monat
          </th>
          <th class="num">
            pro Fahrzeug und Monat
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>30 Tage testen</td>
          <td class="num">
            gratis
          </td>
          <td class="num">
            –
          </td>
          <td class="num muted">
            alle Funktionen
          </td>
        </tr>
        <tr v-for="n in ROWS" :key="n" :class="{ current: n === count }">
          <td>{{ n }}</td>
          <td class="num">
            {{ chf(yearlyPriceChf(n)) }}
          </td>
          <td class="num">
            {{ chf(yearlyPriceChf(n) / 12) }}
          </td>
          <td class="num muted">
            {{ chf(yearlyPriceChf(n) / n / 12) }}
          </td>
        </tr>
        <tr v-if="MAX >= 25">
          <td>mehr als {{ MAX }}</td>
          <td class="num" colspan="3">
            auf Anfrage
          </td>
        </tr>
      </tbody>
    </table>

    <div class="price-calc">
      <label for="price-vehicles">Wie viele Fahrzeuge hast du?</label>
      <div class="price-calc-row">
        <Slider v-model="count" input-id="price-vehicles" :min="1" :max="MAX" class="price-slider" aria-label="Fahrzeuge für die Preisrechnung" />
        <span class="price-count">{{ count }}</span>
      </div>
      <p class="price-result" data-testid="price-result">
        <strong>{{ chf(yearly) }} im Jahr</strong>
        <span>{{ chf(monthly) }} im Monat, {{ chf(perVehicle) }} pro Fahrzeug und Monat</span>
      </p>
    </div>

    <ul class="price-includes">
      <li><i class="pi pi-check" /> Scannen ohne Limit im Alltag, Chat-Assistent, E-Mail-Erinnerungen</li>
      <li><i class="pi pi-check" /> Kosten pro Fahrzeug und Jahr für Excel, PDF-Dossier, Serviceheft für den Verkauf</li>
      <li><i class="pi pi-check" /> Jahresrechnung, keine Grundgebühr, jederzeit kündbar</li>
    </ul>
  </div>
</template>

<style scoped>
.price-table {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 640px;
  margin: 0 auto;
}

.price-intro {
  margin: 0;
  text-align: center;
  color: var(--p-text-muted-color);
  line-height: 1.6;
}

.price-grid {
  width: 100%;
  border-collapse: collapse;
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: var(--p-border-radius);
  overflow: hidden;
}

.price-grid th,
.price-grid td {
  padding: 0.6rem 0.9rem;
  border-bottom: 1px solid var(--p-surface-border);
  text-align: left;
}

.price-grid th {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--p-text-muted-color);
}

.price-grid tr:last-child td {
  border-bottom: none;
}

.price-grid .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.price-grid .muted {
  color: var(--p-text-muted-color);
}

.price-grid tr.current td {
  background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
  font-weight: 600;
}

.price-calc {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1rem 1.25rem;
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: var(--p-border-radius);
}

.price-calc label {
  font-weight: 600;
}

.price-calc-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.price-slider {
  flex: 1;
}

.price-count {
  min-width: 2.5rem;
  text-align: right;
  font-size: 1.25rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.price-result {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.price-result strong {
  font-size: 1.5rem;
}

.price-result span {
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
}

.price-includes {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
}

.price-includes i {
  color: var(--p-primary-color);
  margin-right: 0.4rem;
}

@media (max-width: 560px) {
  .price-grid th:last-child,
  .price-grid td:last-child {
    display: none;
  }
}
</style>
