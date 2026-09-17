<script setup lang="ts">
/**
 * Zwei Listen, gleiche Funktionen (business-plan/03-produkt.md «Abgrenzung»): Privat 25 CHF im Jahr bis fünf
 * Fahrzeuge, Betrieb 36 CHF pro Fahrzeug und Jahr mit Jahresrechnung auf die Firma. Rechnet mit yearlyPriceChf aus
 * dem Plan-Katalog, damit Seite und Abrechnung nie auseinanderlaufen.
 */
import type { Audience } from '@strainovic/ai-proxy/plans'
import { BUSINESS_VEHICLE_YEARLY_CHF, PRIVATE_MAX_VEHICLES, PRIVATE_YEARLY_CHF, yearlyPriceChf } from '@strainovic/ai-proxy/plans'
import SelectButton from 'primevue/selectbutton'
import Slider from 'primevue/slider'
import { computed, ref } from 'vue'
import { formatCurrency, formatNumber } from '../lib/locale'

const props = withDefaults(defineProps<{
  /** Liste, die zuerst offen ist; mit `fixed` ohne Umschalter (Angebotsseiten) */
  audience?: Audience
  fixed?: boolean
  /** Startwert des Reglers für Betriebe */
  vehicles?: number
  /** kompakt: ohne Einleitungssatz, für die Angebotsseiten */
  compact?: boolean
}>(), { audience: 'privat', fixed: false, vehicles: 5, compact: false })

const audience = ref<Audience>(props.audience)
const AUDIENCES = [
  { label: 'Privat', value: 'privat' as Audience },
  { label: 'Betrieb', value: 'betrieb' as Audience },
]

const MAX = 25
const ROWS = [1, 3, 5, 10, 25]
const count = ref(props.vehicles)
const yearly = computed(() => yearlyPriceChf(count.value, 'betrieb'))

function chf(value: number): string {
  return formatCurrency(Math.round(value * 100) / 100)
}
</script>

<template>
  <div class="price-table" data-testid="price-table">
    <SelectButton
      v-if="!fixed"
      v-model="audience"
      :options="AUDIENCES"
      option-label="label"
      option-value="value"
      :allow-empty="false"
      class="price-switch"
      aria-label="Privat oder Betrieb"
    />

    <!-- Privat: ein Preis, Parität mit Drivvo Person, dafür Belegscan, MFK und keine Werbung -->
    <div v-if="audience === 'privat'" class="price-card" data-testid="price-privat">
      <!-- Auf den Angebotsseiten steht der Preis schon als Überschrift (compact), hier nur auf der Startseite -->
      <div v-if="!compact" class="price-headline">
        <strong>{{ formatNumber(PRIVATE_YEARLY_CHF) }} CHF im Jahr</strong>
        <span>{{ chf(PRIVATE_YEARLY_CHF / 12) }} im Monat, bis {{ PRIVATE_MAX_VEHICLES }} Fahrzeuge</span>
      </div>
      <p class="price-intro">
        Ein Preis für dein Auto, das Motorrad und den Wohnwagen zusammen. 30 Tage gratis testen, mit allem;
        danach brauchen nur KI-Scan und Chat das Abo. Mehr als {{ PRIVATE_MAX_VEHICLES }} Fahrzeuge? Dann gilt die Betriebsliste.
      </p>
    </div>

    <!-- Betrieb: pro Fahrzeug, ohne Grundgebühr, Jahresrechnung auf die Firma -->
    <div v-else data-testid="price-betrieb">
      <div v-if="!compact" class="price-headline">
        <strong>{{ formatNumber(BUSINESS_VEHICLE_YEARLY_CHF) }} CHF pro Fahrzeug und Jahr</strong>
        <span>{{ chf(BUSINESS_VEHICLE_YEARLY_CHF / 12) }} pro Fahrzeug und Monat, keine Grundgebühr, Jahresrechnung auf die Firma</span>
      </div>
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
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>30 Tage testen</td>
            <td class="num">
              gratis
            </td>
            <td class="num muted">
              alle Funktionen
            </td>
          </tr>
          <tr v-for="n in ROWS" :key="n" :class="{ current: n === count }">
            <td>{{ n }}</td>
            <td class="num">
              {{ chf(yearlyPriceChf(n, 'betrieb')) }}
            </td>
            <td class="num">
              {{ chf(yearlyPriceChf(n, 'betrieb') / 12) }}
            </td>
          </tr>
          <tr>
            <td>mehr als {{ MAX }}</td>
            <td class="num" colspan="2">
              auf Anfrage
            </td>
          </tr>
        </tbody>
      </table>

      <div class="price-calc">
        <label for="price-vehicles">Wie viele Fahrzeuge hat dein Betrieb?</label>
        <div class="price-calc-row">
          <Slider v-model="count" input-id="price-vehicles" :min="1" :max="MAX" class="price-slider" aria-label="Fahrzeuge für die Preisrechnung" />
          <span class="price-count">{{ count }}</span>
        </div>
        <p class="price-result" data-testid="price-result">
          <strong>{{ chf(yearly) }} im Jahr</strong>
          <span>{{ chf(yearly / 12) }} im Monat</span>
        </p>
      </div>
    </div>

    <ul class="price-includes">
      <li><i class="pi pi-check" /> Scannen ohne Limit im Alltag, Chat-Assistent, E-Mail-Erinnerungen</li>
      <li><i class="pi pi-check" /> Kosten pro Fahrzeug und Jahr für Excel, PDF-Dossier, Serviceheft für den Verkauf</li>
      <li><i class="pi pi-check" /> Jahresrechnung, keine Grundgebühr, jederzeit kündbar, gleiche Funktionen für alle</li>
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

.price-switch {
  align-self: center;
}

.price-card {
  padding: 1.25rem;
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: var(--p-border-radius);
  text-align: center;
}

.price-headline {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: center;
  text-align: center;
  margin-bottom: 1rem;
}

.price-headline strong {
  font-size: 1.6rem;
}

.price-headline span {
  color: var(--p-text-muted-color);
  font-size: 0.95rem;
}

.price-intro {
  margin: 0;
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
  margin-top: 1rem;
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
</style>
