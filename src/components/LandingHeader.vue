<script setup lang="ts">
import type { LandingSegment } from '../stores/events'
import Button from 'primevue/button'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useEventsStore } from '../stores/events'

// Ein Kopf für alle öffentlichen Seiten (/, /betrieb, /privathalter, /impressum, /datenschutz):
// Logo, Menü mit Ankern auf die Startseite, Knopf in die Testzeit. Auf Handy bleiben Logo und Knopf.
const props = defineProps<{
  /** Klick auf den Knopf zählt in `events`, wenn die Seite zu einer Hypothese gehört */
  segment?: LandingSegment
}>()

const router = useRouter()
const { user } = useAuth()
const events = useEventsStore()

function goToApp() {
  if (user.value) {
    router.push('/dashboard')
    return
  }
  if (props.segment)
    events.trackCta(props.segment)
  router.push('/login')
}
</script>

<template>
  <header class="landing-header">
    <div class="landing-header-inner">
      <router-link to="/" class="landing-logo">
        <i class="pi pi-car" />
        <span>Wartungsheft</span>
      </router-link>
      <nav class="landing-nav">
        <router-link to="/#features">
          Features
        </router-link>
        <router-link to="/#how-it-works">
          So funktioniert's
        </router-link>
        <router-link to="/#preise">
          Preise
        </router-link>
        <router-link to="/betrieb">
          Für Betriebe
        </router-link>
        <router-link to="/privathalter">
          Für Privathalter
        </router-link>
        <Button
          :label="user ? 'Zur Übersicht' : '30 Tage gratis testen'"
          size="small"
          @click="goToApp"
        />
      </nav>
    </div>
  </header>
</template>

<style scoped>
.landing-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--p-surface-card);
  border-bottom: 1px solid var(--p-surface-border);
  backdrop-filter: blur(8px);
}

.landing-header-inner {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1.5rem;
}

.landing-logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--p-primary-color);
  text-decoration: none;
}

.landing-logo i {
  font-size: 1.5rem;
}

.landing-nav {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.landing-nav a {
  color: var(--p-text-muted-color);
  text-decoration: none;
  font-size: 0.9rem;
  white-space: nowrap;
  transition: color 0.2s;
}

.landing-nav a:hover {
  color: var(--p-text-color);
}

.landing-nav .p-button {
  white-space: nowrap;
}

@media (max-width: 768px) {
  .landing-nav a {
    display: none;
  }
}
</style>
