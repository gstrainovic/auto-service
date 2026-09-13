<script setup lang="ts">
import HypothesisPage from '../components/HypothesisPage.vue'

// Hypothese H1: Kleinbetrieb mit 3 bis 15 Fahrzeugen (business-plan/09-validierung.md)
const benefits = [
  { icon: 'pi-camera', title: 'Rechnung fotografieren, fertig', text: 'Werkstatt, Datum, Betrag und Kilometerstand werden ausgelesen und dem richtigen Fahrzeug zugeordnet.' },
  { icon: 'pi-calendar', title: 'MFK und Service pro Fahrzeug', text: 'Auf einen Blick, welcher Wagen als Nächstes dran ist. Keine verpasste MFK, keine Busse.' },
  { icon: 'pi-file-excel', title: 'Kosten pro Fahrzeug und Jahr', text: 'Alle Belege an einem Ort, Zusammenstellung für den Treuhänder auf Knopfdruck.' },
]
</script>

<template>
  <HypothesisPage
    segment="betrieb"
    title="Alle Firmenfahrzeuge im Blick, ohne Excel und Wandkalender"
    problem="Bei drei bis fünfzehn Fahrzeugen weiss niemand mehr sicher, welcher Wagen wann zur MFK muss, wann der letzte Service war und was er im Jahr kostet. Die Belege liegen verstreut."
    :benefits="benefits"
    price="29 bis 49 CHF im Monat"
    price-note="pro Betrieb, alle Fahrzeuge inklusive, Jahresrechnung. Die ersten drei Betriebe ein Jahr lang kostenlos, wir richten alles ein."
    cta="Frühzugang anfragen"
    note-label="Anzahl Fahrzeuge"
  />
</template>
