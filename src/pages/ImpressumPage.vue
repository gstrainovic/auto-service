<script setup lang="ts">
import Button from 'primevue/button'
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="legal-page">
    <header class="legal-header">
      <div class="legal-container legal-header-inner">
        <router-link to="/" class="legal-logo">
          <i class="pi pi-car" />
          <span>Auto-Service</span>
        </router-link>
        <Button label="Zurück" icon="pi pi-arrow-left" text size="small" @click="router.back()" />
      </div>
    </header>

    <main class="legal-container legal-content">
      <h1>Impressum</h1>

      <h2>Angaben gemäss Art. 3 Abs. 1 lit. s UWG</h2>

      <h3>Kontakt</h3>
      <p>
        <strong>Goran Strainovic</strong><br>
        Strainovic IT (Einzelfirma)<br>
        9323 Steinach<br>
        Schweiz
      </p>
      <p>
        E-Mail: <a href="mailto:info@strainovic-it.ch">info@strainovic-it.ch</a>
      </p>

      <h3>Vertretungsberechtigte Person</h3>
      <p>Goran Strainovic, Inhaber</p>

      <h2>Haftungsausschluss</h2>

      <h3>Haftung für Inhalte</h3>
      <p>
        Die Inhalte dieser Webseite wurden mit grösster Sorgfalt erstellt.
        Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte
        können wir jedoch keine Gewähr übernehmen.
      </p>

      <h3>Haftung für Links</h3>
      <p>
        Unsere Webseite enthält Links zu externen Webseiten Dritter, auf deren Inhalte
        wir keinen Einfluss haben. Für die Inhalte der verlinkten Seiten ist stets der
        jeweilige Anbieter oder Betreiber verantwortlich.
      </p>

      <h3>KI-gestützte Datenverarbeitung</h3>
      <p>
        Auto-Service verwendet künstliche Intelligenz zur Extraktion von Daten aus
        Rechnungen und Dokumenten. Die extrahierten Daten werden dem Nutzer vor dem
        Speichern zur Bestätigung vorgelegt. Für die Richtigkeit der finalen Daten
        ist der Nutzer verantwortlich.
      </p>

      <h2>Urheberrecht</h2>
      <p>
        Die durch den Betreiber dieser Seite erstellten Inhalte und Werke unterliegen
        dem schweizerischen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung
        und jede Art der Verwertung ausserhalb der Grenzen des Urheberrechtes bedürfen
        der schriftlichen Zustimmung des Autors.
      </p>
    </main>

    <footer class="legal-footer">
      <div class="legal-container footer-inner">
        <router-link to="/">
          Startseite
        </router-link>
        <router-link to="/datenschutz">
          Datenschutz
        </router-link>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.legal-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--p-surface-ground);
}

.legal-header {
  background: var(--p-surface-card);
  border-bottom: 1px solid var(--p-surface-border);
  position: sticky;
  top: 0;
  z-index: 100;
}

.legal-header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
}

.legal-logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--p-primary-color);
  text-decoration: none;
}

.legal-logo i {
  font-size: 1.5rem;
}

.legal-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.legal-content {
  flex: 1;
  padding-top: 2rem;
  padding-bottom: 3rem;
}

.legal-content h1 {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 2rem;
}

.legal-content h2 {
  font-size: 1.4rem;
  font-weight: 600;
  margin: 2rem 0 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--p-surface-border);
}

.legal-content h2:first-of-type {
  border-top: none;
  padding-top: 0;
}

.legal-content h3 {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 1.5rem 0 0.5rem;
}

.legal-content p {
  color: var(--p-text-muted-color);
  line-height: 1.7;
  margin: 0 0 1rem;
}

.legal-content a {
  color: var(--p-primary-color);
}

.legal-footer {
  padding: 1.5rem 0;
  border-top: 1px solid var(--p-surface-border);
  background: var(--p-surface-card);
}

.footer-inner {
  display: flex;
  gap: 1.5rem;
  justify-content: center;
}

.footer-inner a {
  color: var(--p-text-muted-color);
  text-decoration: none;
  font-size: 0.9rem;
}

.footer-inner a:hover {
  color: var(--p-text-color);
}
</style>
