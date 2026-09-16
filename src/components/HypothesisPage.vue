<script setup lang="ts">
import type { LandingSegment } from '../stores/events'
import Button from 'primevue/button'
import { useRouter } from 'vue-router'
import { useEventsStore } from '../stores/events'
import LandingFooter from './LandingFooter.vue'
import LandingHeader from './LandingHeader.vue'
import PriceTable from './PriceTable.vue'

// Landing Page pro Hypothese (business-plan/09-validierung.md, M3): Problem in einem Satz,
// drei Nutzen, Preis sichtbar, ein Button in die Testzeit. Fragen gehen per Mail ans Postfach.
const props = defineProps<{
  segment: LandingSegment
  title: string
  problem: string
  benefits: { icon: string, title: string, text: string }[]
  price: string
  priceNote: string
  cta: string
  /** Startwert des Preisreglers */
  vehicles?: number
  /** Obergrenze des Preisreglers */
  maxVehicles?: number
  /** Betreff der Kontakt-Mail; ohne Angabe keine Kontaktzeile unter dem Knopf */
  contactSubject?: string
}>()

const CONTACT_EMAIL = 'info@wartungsheft.ch'

const router = useRouter()
const events = useEventsStore()

// Hauptweg ist die Testzeit: der Klick zählt als Interesse und führt zur Anmeldung
function startTrial() {
  events.trackCta(props.segment)
  router.push('/login')
}
</script>

<template>
  <div class="hypo">
    <LandingHeader :segment="segment" />

    <main class="hypo-container hypo-main">
      <section class="hypo-hero">
        <h1>{{ title }}</h1>
        <p class="hypo-problem">
          {{ problem }}
        </p>
      </section>

      <section class="hypo-benefits">
        <div v-for="b in benefits" :key="b.title" class="hypo-benefit">
          <i :class="`pi ${b.icon}`" />
          <h2>{{ b.title }}</h2>
          <p>{{ b.text }}</p>
        </div>
      </section>

      <section class="hypo-price">
        <strong>{{ price }}</strong>
        <span>{{ priceNote }}</span>
        <PriceTable :vehicles="vehicles ?? 1" :max="maxVehicles ?? 25" compact class="hypo-price-table" />
        <div class="hypo-actions">
          <Button :label="cta" size="large" icon="pi pi-arrow-right" icon-pos="right" @click="startTrial" />
        </div>
        <p v-if="contactSubject" class="hypo-contact">
          Fragen vorab? Schreib an
          <a :href="`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(contactSubject)}`">{{ CONTACT_EMAIL }}</a>,
          wir antworten am gleichen Tag.
        </p>
      </section>
    </main>

    <LandingFooter />
  </div>
</template>

<style scoped>
.hypo {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: var(--p-font-family);
  color: var(--p-text-color);
  background: var(--p-surface-ground);
}

.hypo-container {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 0 1.5rem;
  box-sizing: border-box;
}

.hypo-main {
  flex: 1;
  padding-top: 3rem;
  padding-bottom: 4rem;
}

.hypo-hero {
  text-align: center;
  margin-bottom: 3rem;
}

.hypo-hero h1 {
  font-size: clamp(1.8rem, 4.5vw, 3rem);
  font-weight: 800;
  line-height: 1.15;
  margin: 0 0 1rem;
}

.hypo-problem {
  font-size: 1.15rem;
  color: var(--p-text-muted-color);
  max-width: 620px;
  margin: 0 auto;
  line-height: 1.6;
}

.hypo-benefits {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.hypo-benefit {
  padding: 1.5rem;
  border-radius: var(--p-border-radius);
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
}

.hypo-benefit i {
  font-size: 1.75rem;
  color: var(--p-primary-color);
  display: block;
  margin-bottom: 0.75rem;
}

.hypo-benefit h2 {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
}

.hypo-benefit p {
  margin: 0;
  color: var(--p-text-muted-color);
  line-height: 1.5;
}

.hypo-price {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 2.5rem;
}

.hypo-price strong {
  font-size: 2rem;
  font-weight: 800;
}

.hypo-price span {
  color: var(--p-text-muted-color);
  margin-bottom: 1rem;
}

.hypo-price-table {
  width: 100%;
  text-align: left;
  margin-bottom: 1.5rem;
}

.hypo-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
}

.hypo-contact {
  margin: 1rem 0 0;
  font-size: 0.95rem;
  color: var(--p-text-muted-color);
}

.hypo-contact a {
  color: var(--p-primary-color);
}
</style>
