<script setup lang="ts">
import HypothesisPage from '../components/HypothesisPage.vue'

// Hypothese H1: Kleinbetrieb mit 3 bis 15 Fahrzeugen (business-plan/09-validierung.md)
// Nach den Beobachtungen (business-plan/beobachtungen.md): MFK ist kein Hauptschmerz, das Aufgebot kommt vom
// Strassenverkehrsamt. Der Schmerz ist Zeit, verstreute Belege und fehlender Kostenüberblick.
const benefits = [
  { icon: 'pi-camera', title: 'Rechnung fotografieren, fertig', text: 'Werkstatt, Datum, Betrag und Kilometerstand werden ausgelesen und dem richtigen Fahrzeug zugeordnet. Keine Excel-Tabelle, die niemand pflegt.' },
  { icon: 'pi-calendar', title: 'Service, Reifen und MFK pro Fahrzeug', text: 'Auf einen Blick, welcher Wagen als Nächstes dran ist und was zuletzt gemacht wurde. Eine E-Mail erinnert dich rechtzeitig.' },
  { icon: 'pi-file-excel', title: 'Kosten pro Fahrzeug und Jahr', text: 'Alle Belege an einem Ort, Zusammenstellung für den Treuhänder auf Knopfdruck. Kein Suchen im Handschuhfach vor dem Jahresabschluss.' },
]
</script>

<template>
  <HypothesisPage
    segment="betrieb"
    title="Alle Firmenfahrzeuge im Blick, ohne Excel und Aktenordner"
    problem="Bei drei bis fünfzehn Fahrzeugen kostet die Verwaltung Stunden im Monat: Belege verstreut, kein Überblick, wann welcher Wagen zum Service war, und am Jahresende weiss niemand, was welches Fahrzeug gekostet hat."
    :benefits="benefits"
    price="29 bis 49 CHF im Monat"
    price-note="pro Betrieb, alle Fahrzeuge inklusive, Jahresrechnung. Die ersten drei Betriebe ein Jahr lang kostenlos, wir richten alles ein."
    cta="Frühzugang anfragen"
    note-label="Anzahl Fahrzeuge"
  />
</template>
