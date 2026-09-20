<script setup lang="ts">
/**
 * Hilfe in Textform statt Bedienvideos: ein Abschnitt je Kernablauf (CLAUDE.md «Abläufe prüfen, nicht nur
 * Seiten»), dazu die häufigen Fragen. Die Seite dient dreifach — Antwort im Postfach statt Erklärung von Hand,
 * Text für Suchmaschinen und KI-Antworten (FAQPage weiter unten), und Prüfliste für uns.
 *
 * Wer einen Ablauf ändert, ändert hier mit. Steht ein Schritt nur hier und nicht in der App, ist das ein
 * Hinweis auf eine Lücke in der Oberfläche, nicht auf eine fehlende Anleitung.
 */
import { BUSINESS_VEHICLE_YEARLY_CHF, PRIVATE_MAX_VEHICLES, PRIVATE_YEARLY_CHF } from '@strainovic/ai-proxy/plans'
import { onBeforeUnmount, onMounted } from 'vue'
import LandingFooter from '../components/LandingFooter.vue'
import LandingHeader from '../components/LandingHeader.vue'
import { formatCurrency } from '../lib/locale'

const CONTACT_EMAIL = 'info@wartungsheft.ch'

/** Die Antworten stehen doppelt: sichtbar auf der Seite und als FAQPage für Suchmaschinen und KI-Antworten */
const FRAGEN: { frage: string, antwort: string }[] = [
  {
    frage: 'Was ist Wartungsheft?',
    antwort: `Wartungsheft ist ein digitales Serviceheft für Autos, Motorräder, Wohnwagen und Firmenfahrzeuge. `
      + `Du fotografierst die Werkstattrechnung, die App liest Werkstatt, Datum, Betrag und Arbeiten heraus und `
      + `führt daraus den Wartungsplan. Sie läuft im Browser, auch offline, und wird in der Schweiz betrieben.`,
  },
  {
    frage: 'Was kostet Wartungsheft?',
    antwort: `Privat ${formatCurrency(PRIVATE_YEARLY_CHF)} im Jahr für bis zu ${PRIVATE_MAX_VEHICLES} Fahrzeuge. `
      + `Betriebe zahlen ${formatCurrency(BUSINESS_VEHICLE_YEARLY_CHF)} pro Fahrzeug und Jahr und bekommen eine `
      + `Rechnung auf die Firma. Beide Listen haben denselben Funktionsumfang. Die ersten 30 Tage sind gratis.`,
  },
  {
    frage: 'Was passiert nach den 30 Tagen?',
    antwort: `Lesen, Erfassen von Hand und alle Exporte bleiben frei. Nur der Scan von Rechnungen und der `
      + `Chat-Assistent brauchen danach ein Abo. Deine Daten bleiben vollständig erhalten.`,
  },
  {
    frage: 'Brauche ich eine App aus dem Store?',
    antwort: `Nein. Wartungsheft läuft im Browser und lässt sich auf dem Handy zum Startbildschirm hinzufügen. `
      + `Danach verhält es sich wie eine App und funktioniert auch ohne Verbindung.`,
  },
  {
    frage: 'Wo liegen meine Daten?',
    antwort: `Auf Servern in der Schweiz. Für das Auslesen von Rechnungen geht das Bild an Mistral in Frankreich `
      + `(EU); Einzelheiten stehen in der Datenschutzerklärung.`,
  },
  {
    frage: 'Kann ich meine Daten wieder herausbekommen?',
    antwort: `Ja. Kosten und Wartungen gehen als CSV nach Excel, pro Fahrzeug gibt es ein PDF-Dossier und für `
      + `den Verkauf ein Serviceheft als PDF. Ein Jahresabschluss packt Tabelle und Belegbilder in ein ZIP.`,
  },
]

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  'mainEntity': FRAGEN.map(f => ({
    '@type': 'Question',
    'name': f.frage,
    'acceptedAnswer': { '@type': 'Answer', 'text': f.antwort },
  })),
}

// Das Schema gehört in den Kopf des Dokuments; eine einzelne Seite trägt es nur, solange sie offen ist
let script: HTMLScriptElement | null = null
onMounted(() => {
  script = document.createElement('script')
  script.type = 'application/ld+json'
  script.textContent = JSON.stringify(FAQ_SCHEMA)
  document.head.appendChild(script)
})
onBeforeUnmount(() => {
  script?.remove()
  script = null
})
</script>

<template>
  <div class="legal-page">
    <LandingHeader />

    <main class="legal-container legal-content">
      <h1>Hilfe: so führst du dein Serviceheft</h1>
      <p class="legal-meta">
        Neun Abläufe, jeder in ein paar Sätzen. Kommst du irgendwo nicht weiter, schreib an
        <a :href="`mailto:${CONTACT_EMAIL}`">{{ CONTACT_EMAIL }}</a> oder nimm in der App unter «Fehler melden
        oder Wunsch» eine Sprachnachricht auf.
      </p>

      <h2>1. Fahrzeug erfassen</h2>
      <p>
        «Fahrzeug hinzufügen» im Dashboard oder in der Fahrzeugliste. Du kannst den Fahrzeugausweis
        fotografieren, dann füllt die App Kontrollschild, Marke, Typ, Fahrgestellnummer und die erste
        Inverkehrsetzung selbst aus. Leere Felder bleiben leer: Baujahr und Kilometerstand 0 heissen
        «unbekannt», nicht «null». Nach dem Speichern stehst du auf der Fahrzeugseite, wo eine Checkliste die
        nächsten Schritte vorschlägt. Jeder davon ist überspringbar.
      </p>

      <h2>2. Rechnung erfassen und alte Belege nachtragen</h2>
      <p>
        «Rechnung hinzufügen» auf der Fahrzeugseite, dann ein Foto der Werkstattrechnung. Die App liest
        Werkstatt, Datum, Betrag und die einzelnen Positionen heraus und legt zu jeder Kategorie gleich eine
        Wartung an. Mehrere Fotos oder ein Sammel-PDF gehen auch: daraus wird eine Prüfliste, in der du jede
        Rechnung einzeln bestätigst. Erkennt die App eine Rechnung doppelt, meldet sie das, statt sie zweimal
        zu speichern. Du kannst alles auch von Hand eintippen oder ansagen.
      </p>

      <h2>3. Wartung ohne Rechnung eintragen</h2>
      <p>
        Nicht jede Arbeit hat einen Beleg — Öl selbst gewechselt, Reifen beim Kollegen montiert. Im Tab
        «Verlauf» trägst du das über «Wartung hinzufügen» ein: Art, Datum, Kilometerstand, Beschreibung. Für
        den Wartungsplan zählt dieser Eintrag genauso wie einer aus einer Rechnung.
      </p>

      <h2>4. Serviceheft und Intervalle hinterlegen</h2>
      <p>
        Ohne eigene Angaben rechnet die App mit allgemeinen Intervallen. Genauer wird es mit dem gedruckten
        Serviceheft: «Serviceheft fotografieren» liest die Intervalle des Herstellers und die Stempel früherer
        Services aus und schlägt sie dir vor. Stempel, die schon erfasst sind, erkennt die App und trägt sie
        nicht doppelt ein. Einzelne Intervalle lassen sich danach von Hand anpassen.
      </p>

      <h2>5. Kosten exportieren</h2>
      <p>
        Tab «Kosten» auf der Fahrzeugseite: Kosten pro Jahr und Kategorie, als CSV für Excel oder als
        PDF-Dossier mit Stammdaten, Wartungen und Rechnungen. Für alle Fahrzeuge zusammen steht dieselbe
        Tabelle im Dashboard. Rechnungen in Euro rechnet die App zum Kurs des Rechnungsdatums in deine
        Heimwährung um; ohne Kurs bleibt der Betrag in seiner Währung und ist als «nicht umgerechnet»
        gekennzeichnet.
      </p>

      <h2>6. Erinnerung bekommen und Arbeit abhaken</h2>
      <p>
        Wird eine Arbeit fällig — 30 Tage oder 1'000 Kilometer vorher —, schickt Wartungsheft eine E-Mail mit
        allem, was ansteht. Der Link darin führt direkt zum Fahrzeug. Ist die Arbeit erledigt, trägst du sie
        mit «Erledigt eintragen» in der Fälligkeitsliste ein; Datum und Kilometerstand sind vorbelegt. Hast du
        schon einen Termin, setz den Status auf «Geplant» — dann erinnert die App nicht weiter. Abschalten
        lassen sich die Erinnerungen in den Einstellungen.
      </p>

      <h2>7. Fahrzeug verkaufen oder abgeben</h2>
      <p>
        Vor dem Verkauf: Serviceheft als PDF erzeugen, mit oder ohne Preise. Danach auf der Fahrzeugseite
        «Verkauft oder abgegeben» mit Datum und Kilometerstand. Das Fahrzeug verschwindet aus Dashboard und
        Erinnerungen, bleibt aber in Kosten und Exporten erhalten — löschen musst du nichts, und rückgängig
        machen lässt es sich auch.
      </p>

      <h2>8. Kilometerstand aktuell halten</h2>
      <p>
        Jede Rechnung mit höherem Kilometerstand hebt den Stand des Fahrzeugs automatisch an. Zwischendurch
        kannst du ihn im Dashboard direkt nachführen. Das lohnt sich, weil die Fälligkeit nach Datum und nach
        Kilometern rechnet.
      </p>

      <h2>9. Fuhrpark: sehen, was fällig ist</h2>
      <p>
        Das Dashboard zeigt über alle Fahrzeuge hinweg, was fällig oder überfällig ist, das Dringendste zuerst.
        Ein Klick führt zum Fahrzeug. Die Fuhrpark-Tabelle darunter nennt die Kosten pro Fahrzeug und Jahr und
        lässt sich als CSV oder PDF herunterladen. Für Betriebe gilt derselbe Funktionsumfang wie privat, nur
        die Preisliste ist eine andere.
      </p>

      <h2>Häufige Fragen</h2>
      <template v-for="f in FRAGEN" :key="f.frage">
        <h3>{{ f.frage }}</h3>
        <p>{{ f.antwort }}</p>
      </template>

      <h2>Noch offen?</h2>
      <p>
        Schreib an <a :href="`mailto:${CONTACT_EMAIL}`">{{ CONTACT_EMAIL }}</a>. In der App geht es auch ohne
        Tippen: «Fehler melden oder Wunsch» im Menü nimmt eine Sprachnachricht auf.
        Rechtliches steht in den <router-link to="/agb">
          AGB
        </router-link> und in der
        <router-link to="/datenschutz">
          Datenschutzerklärung
        </router-link>.
      </p>
    </main>

    <LandingFooter />
  </div>
</template>

<style scoped>
.legal-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--p-surface-ground);
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
  font-size: clamp(1.5rem, 6vw, 2rem);
  font-weight: 700;
  margin: 0 0 0.5rem;
  hyphens: auto;
  overflow-wrap: break-word;
}

.legal-meta {
  margin-bottom: 2rem !important;
}

.legal-content h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 2rem 0 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--p-surface-border);
}

.legal-content h3 {
  font-size: 1.05rem;
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
</style>
