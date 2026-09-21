<script setup lang="ts">
import type { LandingSegment } from '../stores/events'
import Button from 'primevue/button'
import { useAuthEntry } from '../composables/useAuthEntry'
import AppLogo from './AppLogo.vue'

// Ein Kopf für alle öffentlichen Seiten (/, /betrieb, /privathalter, /impressum, /datenschutz):
// Logo, Menü mit Ankern auf die Startseite, «Anmelden» und der Knopf in die Testzeit. Auf Handy bleiben
// Logo-Symbol, «Anmelden» und Knopf. Kennt der Browser das Konto schon, entfällt der Test-Knopf.
const props = defineProps<{
  /** Klick auf den Knopf zählt in `events`, wenn die Seite zu einer Hypothese gehört */
  segment?: LandingSegment
}>()

const { entry, label, go } = useAuthEntry(props.segment)
</script>

<template>
  <header class="landing-header">
    <div class="landing-header-inner">
      <router-link to="/" class="landing-logo" aria-label="Wartungsheft">
        <AppLogo size="1.75rem" />
        <span class="landing-logo-text">Wartungsheft</span>
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
        <router-link
          v-if="entry !== 'app'"
          to="/login"
          class="landing-login"
          :class="{ 'landing-login-known': entry === 'login' }"
        >
          Anmelden
        </router-link>
        <Button
          v-if="entry !== 'login'"
          :label="label"
          size="small"
          @click="go"
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

.landing-nav a.landing-login {
  color: var(--p-text-color);
  font-weight: 600;
}

/* Bekanntes Konto: «Anmelden» ist der einzige Knopf im Kopf */
.landing-nav a.landing-login-known {
  padding: 0.4rem 0.9rem;
  border-radius: var(--p-border-radius-md, 6px);
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
}

@media (max-width: 768px) {
  .landing-nav a:not(.landing-login) {
    display: none;
  }
}

/* Handy: Logo nur als Symbol, damit «Anmelden» und der Test-Knopf in eine Zeile passen */
@media (max-width: 480px) {
  .landing-header-inner {
    padding: 0.75rem 1rem;
  }

  .landing-logo-text {
    display: none;
  }
}
</style>
