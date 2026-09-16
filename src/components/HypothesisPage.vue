<script setup lang="ts">
import type { LeadSegment } from '../lib/leads'
import Button from 'primevue/button'
import { nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLeadsStore } from '../stores/leads'
import LeadForm from './LeadForm.vue'
import PriceTable from './PriceTable.vue'

// Landing Page als Türattrappe (business-plan/09-validierung.md, M3): Problem in einem Satz,
// drei Nutzen, Preis sichtbar, ein Button. Der Button öffnet nur ein E-Mail-Formular, kein Zahlungsvorgang.
const props = defineProps<{
  segment: LeadSegment
  title: string
  problem: string
  benefits: { icon: string, title: string, text: string }[]
  price: string
  priceNote: string
  cta: string
  noteLabel?: string
  /** Startwert des Preisreglers */
  vehicles?: number
  /** Obergrenze des Preisreglers */
  maxVehicles?: number
  /** zweiter Weg: Einrichtung durch uns, öffnet das Lead-Formular */
  secondaryCta?: string
  /** Angebot im Rahmen, z. B. die ersten drei Betriebe gratis */
  offer?: string
}>()

const router = useRouter()
const leads = useLeadsStore()

// Hauptweg ist die Testzeit: der Klick zählt als Interesse und führt zur Anmeldung
function startTrial() {
  leads.trackCta(props.segment)
  router.push('/login')
}

const showForm = ref(false)
const formEl = ref<HTMLElement | null>(null)

async function openForm() {
  showForm.value = true
  leads.trackCta(props.segment)
  await nextTick()
  formEl.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
</script>

<template>
  <div class="hypo">
    <header class="hypo-header">
      <div class="hypo-container hypo-header-inner">
        <router-link to="/" class="hypo-logo">
          <i class="pi pi-car" />
          <span>Wartungsheft</span>
        </router-link>
        <router-link to="/login" class="hypo-login">
          Anmelden
        </router-link>
      </div>
    </header>

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
        <p v-if="offer" class="hypo-offer">
          {{ offer }}
        </p>
        <div class="hypo-actions">
          <Button :label="cta" size="large" icon="pi pi-arrow-right" icon-pos="right" @click="startTrial" />
          <Button v-if="secondaryCta && !showForm" :label="secondaryCta" size="large" outlined @click="openForm" />
        </div>
      </section>

      <section v-if="showForm" ref="formEl" class="hypo-form">
        <LeadForm :segment="segment" :note-label="noteLabel" />
      </section>
    </main>

    <footer class="hypo-footer">
      <div class="hypo-container footer-inner">
        <span>Goran Strainovic, Strainovic IT, Steinach SG · Schweizer Server, KI in der EU</span>
        <router-link to="/impressum">
          Impressum
        </router-link>
        <router-link to="/datenschutz">
          Datenschutz
        </router-link>
      </div>
    </footer>
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

.hypo-header {
  background: var(--p-surface-card);
  border-bottom: 1px solid var(--p-surface-border);
}

.hypo-header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
}

.hypo-logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--p-primary-color);
  text-decoration: none;
}

.hypo-login {
  color: var(--p-text-muted-color);
  text-decoration: none;
  font-size: 0.9rem;
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

.hypo-offer {
  margin: 0 0 1.25rem;
  padding: 0.9rem 1.2rem;
  border: 1px solid var(--p-primary-color);
  border-radius: var(--p-border-radius);
  background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
  font-weight: 600;
}

.hypo-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
}

.hypo-form {
  padding: 2rem 1.5rem;
  border-radius: var(--p-border-radius);
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
}

.hypo-footer {
  padding: 1.5rem 0;
  border-top: 1px solid var(--p-surface-border);
  background: var(--p-surface-card);
}

.footer-inner {
  display: flex;
  gap: 1.5rem;
  justify-content: center;
  flex-wrap: wrap;
  font-size: 0.9rem;
  color: var(--p-text-muted-color);
}

.footer-inner a {
  color: var(--p-text-muted-color);
  text-decoration: none;
}

.footer-inner a:hover {
  color: var(--p-text-color);
}
</style>
