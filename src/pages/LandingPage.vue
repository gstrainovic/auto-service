<script setup lang="ts">
import Button from 'primevue/button'
import { useRouter } from 'vue-router'
import DemoDueList from '../components/DemoDueList.vue'
import LandingFooter from '../components/LandingFooter.vue'
import LandingHeader from '../components/LandingHeader.vue'
import PriceTable from '../components/PriceTable.vue'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { user } = useAuth()

function goToApp() {
  if (user.value)
    router.push('/dashboard')
  else
    router.push('/login')
}
</script>

<template>
  <div class="landing">
    <!-- Header -->
    <LandingHeader />

    <!-- Hero -->
    <section class="hero">
      <div class="landing-container hero-inner">
        <div class="hero-grid">
          <div class="hero-copy">
            <h1>Rechnung fotografieren. Den Rest erledigt Wartungsheft.</h1>
            <p class="hero-subtitle">
              Serviceheft, Fälligkeiten und Kosten pro Fahrzeug — ohne Abtippen.
              Für ein Auto oder die ganze Flotte.
            </p>
            <div class="hero-actions">
              <Button
                :label="user ? 'Zur Übersicht' : '30 Tage gratis testen'"
                icon="pi pi-arrow-right"
                icon-pos="right"
                size="large"
                @click="goToApp"
              />
            </div>
          </div>
          <DemoDueList class="hero-demo" />
        </div>
        <div class="hero-stats">
          <div class="hero-stat">
            <strong>Ein Foto</strong>
            <span>statt Abtippen</span>
          </div>
          <div class="hero-stat">
            <strong>Offline nutzbar</strong>
            <span>Scan läuft später nach</span>
          </div>
          <div class="hero-stat">
            <strong>Aus der Schweiz</strong>
            <span>Server hier, KI in der EU</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Problem -->
    <section class="section section-alt">
      <div class="landing-container">
        <h2>Das Problem kennt jeder</h2>
        <div class="problem-grid">
          <div class="problem-card">
            <i class="pi pi-folder-open" />
            <h3>Rechnungen überall</h3>
            <p>Schublade, Handschuhfach, E-Mail. Beim Autoverkauf fehlt die Hälfte.</p>
          </div>
          <div class="problem-card">
            <i class="pi pi-calendar-times" />
            <h3>Wartung vergessen</h3>
            <p>Zahnriemen übersehen = Motorschaden = CHF 3'000 bis 8'000. Vermeidbar.</p>
          </div>
          <div class="problem-card">
            <i class="pi pi-calculator" />
            <h3>Kosten im Dunkeln</h3>
            <p>Was hat das Auto dieses Jahr gekostet? Keine Ahnung.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section id="features" class="section">
      <div class="landing-container">
        <h2>Was Wartungsheft dir abnimmt</h2>
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">
              <i class="pi pi-camera" />
            </div>
            <h3>KI-Rechnungsscanner</h3>
            <p>Rechnung abfotografieren. Werkstatt, Datum, Betrag, Einzelpositionen — alles automatisch extrahiert. Scannen ohne Limit im Alltag.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">
              <i class="pi pi-bell" />
            </div>
            <h3>Wartungs-Tracker</h3>
            <p>Auf einen Blick, was ansteht: Öl, Bremsen, MFK, Zahnriemen und was dein Serviceheft sonst vorsieht.</p>
            <DemoDueList compact />
          </div>
          <div class="feature-card">
            <div class="feature-icon">
              <i class="pi pi-sync" />
            </div>
            <h3>Offline-First</h3>
            <p>Fahrzeuge, Rechnungen und Wartungsplan funktionieren ohne Internet. Eine offline fotografierte Rechnung wird gespeichert, der KI-Scan läuft automatisch nach, sobald du wieder online bist.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">
              <i class="pi pi-shield" />
            </div>
            <h3>Schweizer Anbieter, Schweizer Server</h3>
            <p>Entwickelt, betrieben und gespeichert in der Schweiz. Die KI läuft bei Mistral in Frankreich, ohne Training mit deinen Daten. Alles inklusive, nichts extra buchen.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">
              <i class="pi pi-file-pdf" />
            </div>
            <h3>Digitales Serviceheft</h3>
            <p>Lückenlose Wartungshistorie. Beim Autoverkauf den Wert steigern — alles digital belegt.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">
              <i class="pi pi-file-excel" />
            </div>
            <h3>Export für Treuhänder und Käufer</h3>
            <p>Tabelle für Excel, PDF-Dossier pro Fahrzeug und der Jahresabschluss mit allen Rechnungsbildern für den Treuhänder.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section id="how-it-works" class="section section-alt">
      <div class="landing-container">
        <h2>So funktioniert's</h2>
        <div class="steps">
          <div class="step">
            <div class="step-number">
              1
            </div>
            <h3>Foto machen</h3>
            <p>Werkstattrechnung mit dem Handy abfotografieren oder PDF hochladen.</p>
          </div>
          <div class="step-arrow">
            <i class="pi pi-arrow-right" />
          </div>
          <div class="step">
            <div class="step-number">
              2
            </div>
            <h3>KI liest vor</h3>
            <p>Die KI extrahiert automatisch: Werkstatt, Datum, Betrag, Einzelpositionen, KM-Stand.</p>
          </div>
          <div class="step-arrow">
            <i class="pi pi-arrow-right" />
          </div>
          <div class="step">
            <div class="step-number">
              3
            </div>
            <h3>Bestätigen</h3>
            <p>Prüfen, speichern. Fälligkeiten, Serviceheft und Kosten sind sofort aktuell.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Für wen: die Preise stehen auf den zwei Angebotsseiten (Betrieb, Privathalter), hier nur der Weg dorthin -->
    <section id="fuer-wen" class="section">
      <div class="landing-container">
        <h2>Für wen ist Wartungsheft?</h2>
        <p class="section-subtitle">
          Ein Werkzeug, eine Preisliste. Der Unterschied liegt im Alltag, nicht im Preis.
        </p>
        <div class="pricing-grid pricing-grid-two">
          <div class="pricing-card">
            <h3>Betriebe mit Fahrzeugen</h3>
            <p class="audience-text">
              Lieferwagen, Servicefahrzeuge, Firmenwagen: alle Rechnungen und Wartungen an einem Ort,
              Kosten pro Fahrzeug und Jahr, Export für die Buchhaltung.
            </p>
            <ul class="pricing-features">
              <li><i class="pi pi-check" /> Fahrer fotografiert die Rechnung, fertig</li>
              <li><i class="pi pi-check" /> Kosten pro Fahrzeug und Jahr, für Excel und als PDF</li>
              <li><i class="pi pi-check" /> E-Mail-Erinnerungen an fällige Arbeiten</li>
            </ul>
            <Button
              label="Angebot für Betriebe"
              icon="pi pi-arrow-right"
              icon-pos="right"
              fluid
              @click="router.push('/betrieb')"
            />
          </div>
          <div class="pricing-card">
            <h3>Privathalter</h3>
            <p class="audience-text">
              Ein Auto, alle Rechnungen: digitales Serviceheft, Wartungsplan mit Erinnerung und ein PDF-Dossier
              für den Verkauf.
            </p>
            <ul class="pricing-features">
              <li><i class="pi pi-check" /> Rechnung fotografieren statt abtippen</li>
              <li><i class="pi pi-check" /> Erinnerung, bevor es teuer wird</li>
              <li><i class="pi pi-check" /> Lückenlose Historie für den Wiederverkauf</li>
            </ul>
            <Button
              label="Angebot für Privathalter"
              icon="pi pi-arrow-right"
              icon-pos="right"
              outlined
              fluid
              @click="router.push('/privathalter')"
            />
          </div>
        </div>
      </div>
    </section>

    <section id="preise" class="section section-alt">
      <div class="landing-container">
        <h2>Preise</h2>
        <PriceTable />
      </div>
    </section>

    <!-- CTA -->
    <section class="section section-cta">
      <div class="landing-container cta-inner">
        <h2>Bereit? 30 Tage gratis, keine Kreditkarte.</h2>
        <p>Anmelden mit E-Mail, kein Passwort. Nach 30 Tagen entscheidest du.</p>
        <Button
          :label="user ? 'Zur Übersicht' : '30 Tage gratis testen'"
          icon="pi pi-arrow-right"
          icon-pos="right"
          size="large"
          severity="contrast"
          @click="goToApp"
        />
      </div>
    </section>

    <!-- Footer -->
    <LandingFooter />
  </div>
</template>

<style scoped>
.landing {
  font-family: var(--p-font-family);
  color: var(--p-text-color);
  background: var(--p-surface-ground);
}

/* Kopf und Fuss sind LandingHeader.vue und LandingFooter.vue */

/* Container */
.landing-container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

/* Hero */
.hero {
  padding: 5rem 0 4rem;
  text-align: center;
}

.hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 3rem;
  align-items: center;
  text-align: left;
  margin-bottom: 3rem;
}

.hero-demo {
  max-width: 460px;
  width: 100%;
  justify-self: end;
}

.hero h1 {
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 800;
  line-height: 1.1;
  margin: 0 0 1rem;
  color: var(--p-text-color);
}

.hero-subtitle {
  font-size: 1.2rem;
  color: var(--p-text-muted-color);
  max-width: 600px;
  margin: 0 0 2rem;
  line-height: 1.6;
}

@media (max-width: 800px) {
  .hero-grid {
    grid-template-columns: 1fr;
    text-align: center;
    gap: 2rem;
  }

  .hero-subtitle {
    margin: 0 auto 2rem;
  }

  .hero-demo {
    justify-self: center;
  }
}

.hero-stats {
  display: flex;
  justify-content: center;
  gap: 3rem;
  flex-wrap: wrap;
}

.hero-stat {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.hero-stat strong {
  font-size: 1.1rem;
  color: var(--p-primary-color);
}

.hero-stat span {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}

/* Sections */
.section {
  padding: 4rem 0;
}

.section-alt {
  background: var(--p-surface-card);
}

.section h2 {
  text-align: center;
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
}

.section-subtitle {
  text-align: center;
  color: var(--p-text-muted-color);
  margin: 0 0 2.5rem;
}

/* Problem Grid */
.problem-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
  gap: 1.5rem;
  margin-top: 2.5rem;
}

.problem-card {
  padding: 1.5rem;
  border-radius: var(--p-border-radius);
  background: var(--p-surface-ground);
  border: 1px solid var(--p-surface-border);
}

.problem-card i {
  font-size: 2rem;
  color: var(--p-red-500);
  margin-bottom: 0.75rem;
  display: block;
}

.problem-card h3 {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
}

.problem-card p {
  margin: 0;
  color: var(--p-text-muted-color);
  font-size: 0.95rem;
  line-height: 1.5;
}

/* Features Grid */
.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
  gap: 1.5rem;
  margin-top: 2.5rem;
}

.feature-card {
  padding: 1.5rem;
  border-radius: var(--p-border-radius);
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  transition: box-shadow 0.2s;
}

.feature-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.feature-icon {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

.feature-icon i {
  font-size: 1.25rem;
}

.feature-card h3 {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
}

.feature-card p {
  margin: 0;
  color: var(--p-text-muted-color);
  font-size: 0.95rem;
  line-height: 1.5;
}

/* Steps */
.steps {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 1.5rem;
  margin-top: 2.5rem;
  flex-wrap: wrap;
}

.step {
  flex: 1;
  min-width: 200px;
  max-width: 280px;
  text-align: center;
}

.step-number {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0 auto 1rem;
}

.step h3 {
  margin: 0 0 0.5rem;
}

.step p {
  margin: 0;
  color: var(--p-text-muted-color);
  font-size: 0.95rem;
  line-height: 1.5;
}

.step-arrow {
  display: flex;
  align-items: center;
  padding-top: 1rem;
  color: var(--p-text-muted-color);
}

.step-arrow i {
  font-size: 1.5rem;
}

/* Pricing */
.pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr));
  gap: 1.5rem;
  max-width: 900px;
  margin: 2.5rem auto 0;
}

.pricing-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 2rem 1.5rem;
  border-radius: var(--p-border-radius);
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  text-align: center;
}

.pricing-grid-two {
  max-width: 760px;
}

.pricing-card h3 {
  margin: 0 0 1rem;
  font-size: 1.25rem;
}

/* wächst mit, damit Haken-Liste und Knopf in beiden Karten auf gleicher Höhe stehen */
.audience-text {
  flex: 1;
  color: var(--p-text-muted-color);
  margin: 0 0 1.25rem;
  text-align: left;
  line-height: 1.5;
}

.pricing-features {
  list-style: none;
  padding: 0;
  margin: 0 0 1.5rem;
  text-align: left;
}

.pricing-features li {
  padding: 0.4rem 0;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.95rem;
  line-height: 1.4;
}

.pricing-features li i {
  color: var(--p-green-500);
  font-size: 0.85rem;
  flex-shrink: 0;
  margin-top: 0.3rem;
}

/* CTA */
.section-cta {
  text-align: center;
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
  padding: 4rem 0;
}

.section-cta h2 {
  color: inherit;
}

.section-cta p {
  color: inherit;
  opacity: 0.85;
  margin-bottom: 1.5rem;
}

/* Footer */
/* Mobile */
@media (max-width: 768px) {
  .hero {
    padding: 3rem 0 2rem;
  }

  .hero-stats {
    gap: 1.5rem;
  }

  .steps {
    flex-direction: column;
    align-items: center;
  }

  .step-arrow {
    transform: rotate(90deg);
    padding: 0;
  }

  .pricing-grid {
    grid-template-columns: 1fr;
    max-width: 400px;
  }
}
</style>
