<script setup lang="ts">
import HypothesisPage from '../components/HypothesisPage.vue'

// Hypothese H2: Privathalter mit 1 bis 3 Fahrzeugen (business-plan/09-validierung.md)
const benefits = [
  { icon: 'pi-camera', title: 'Rechnung fotografieren, fertig', text: 'Werkstatt, Datum, Betrag, Kilometerstand: alles wird ausgelesen und im Serviceheft abgelegt.' },
  { icon: 'pi-bell', title: 'Erinnerung, bevor es teuer wird', text: 'Öl, Bremsen, Zahnriemen, MFK: die App sagt dir, was als Nächstes fällig ist.' },
  { icon: 'pi-book', title: 'Lückenlose Historie beim Verkauf', text: 'Alle Rechnungen digital, sauber sortiert. Das schafft Vertrauen und bringt einen besseren Preis.' },
]
</script>

<template>
  <HypothesisPage
    segment="privathalter"
    title="Dein Serviceheft fürs Auto, gepflegt vom Handy aus"
    problem="Das Servicebuch im Handschuhfach, die Rechnungen in der Schublade, der Service vergessen, und beim Verkauf fehlt die Hälfte der Historie."
    :benefits="benefits"
    price="25 CHF im Jahr, bis 5 Fahrzeuge"
    price-note="30 Tage gratis mit allen Funktionen, danach entscheidest du. Anmelden mit E-Mail, kein Passwort, keine Kreditkarte."
    cta="30 Tage gratis testen"
  />
</template>
