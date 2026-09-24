<script setup lang="ts">
/**
 * Allgemeine Geschäftsbedingungen. Die Regeln zu Testzeit, Abo, Verlängerung und Kündigung spiegeln den Code:
 * ai-proxy `trial.ts` und `invoice-subscription.ts`, Preise aus `plans.ts`. Wer dort etwas ändert, passt hier an.
 * Du-Form wie überall in der App, auch für Betriebe.
 */
import { BUSINESS_VEHICLE_YEARLY_CHF, PRIVATE_MAX_VEHICLES, PRIVATE_YEARLY_CHF } from '@strainovic/ai-proxy/plans'
import LandingFooter from '../components/LandingFooter.vue'
import LandingHeader from '../components/LandingHeader.vue'
import { formatCurrency } from '../lib/locale'

const CONTACT_EMAIL = 'info@wartungsheft.ch'
</script>

<template>
  <div class="legal-page">
    <LandingHeader />

    <main class="legal-container legal-content">
      <h1>Allgemeine Geschäftsbedingungen</h1>
      <p class="legal-meta">
        Stand: 22. September 2026
      </p>

      <h2>1. Anbieter und Geltungsbereich</h2>
      <p>
        Wartungsheft (wartungsheft.ch) ist ein Angebot von Goran Strainovic, Strainovic IT (Einzelfirma),
        Bahnstrasse 9b, 9323 Steinach, Schweiz, E-Mail <a :href="`mailto:${CONTACT_EMAIL}`">{{ CONTACT_EMAIL }}</a>.
        Diese AGB gelten für alle Konten, die Testzeit und alle Abos, für Privatpersonen und Betriebe.
        Abweichende Bedingungen gelten nur, wenn wir sie schriftlich bestätigen.
      </p>

      <h2>2. Leistung</h2>
      <p>
        Wartungsheft ist ein digitales Serviceheft als Web-App: Fahrzeuge, Rechnungen und Wartungen erfassen,
        Rechnungen und Dokumente mit KI auslesen (Scan und Chat), Fälligkeiten und E-Mail-Erinnerungen, Kosten
        und Exporte. Die App funktioniert auch offline und gleicht die Daten nach, sobald wieder eine Verbindung
        besteht.
      </p>
      <p>
        Die KI liest Rechnungen, Fahrzeugausweise und Servicehefte aus. Sie kann sich dabei irren. Prüfe die
        übernommenen Werte, bevor du dich darauf verlässt. Fälligkeiten und Erinnerungen sind ein Hilfsmittel und
        ersetzen weder die Vorgaben des Herstellers noch amtliche Aufgebote, etwa zur MFK.
      </p>
      <p>
        Wir entwickeln Wartungsheft laufend weiter. Funktionen können sich ändern, solange der Kern erhalten bleibt:
        Rechnungen und Wartungen pro Fahrzeug festhalten, auswerten und exportieren.
      </p>

      <h2>3. Konto</h2>
      <p>
        Du meldest dich mit deiner E-Mail-Adresse und einem Einmal-Code an oder mit Google. Halte den Zugang zu
        diesem Postfach geschützt, denn wer es liest, kann sich anmelden. Betriebe dürfen ein Konto auf eine
        Team-Adresse (z. B. fuhrpark@betrieb.ch) mit mehreren Personen nutzen.
      </p>

      <h2>4. Testzeit</h2>
      <p>
        Jedes neue Konto kann Wartungsheft 30 Tage mit allen Funktionen testen. Die Testzeit beginnt mit dem ersten
        Scan oder der ersten Chat-Anfrage. Sie kostet nichts, verlangt kein Zahlungsmittel und endet von selbst, ohne
        dass ein Abo entsteht.
      </p>
      <p>
        Nach der Testzeit brauchen KI-Scan und Chat ein Abo. Lesen, Erfassen von Hand und Exporte bleiben ohne Abo
        möglich.
      </p>

      <h2>5. Abo und Preise</h2>
      <ul>
        <li>
          <strong>Privat:</strong> {{ formatCurrency(PRIVATE_YEARLY_CHF) }} im Jahr für bis zu
          {{ PRIVATE_MAX_VEHICLES }} Fahrzeuge. Ab dem sechsten Fahrzeug gilt auch privat der Preis pro Fahrzeug.
        </li>
        <li>
          <strong>Betrieb:</strong> {{ formatCurrency(BUSINESS_VEHICLE_YEARLY_CHF) }} pro Fahrzeug und Jahr,
          Rechnung auf die Firma. Massgebend ist die bei der Bestellung angegebene Zahl, bei jeder Verlängerung die
          Zahl der dann aktiven Fahrzeuge (verkaufte oder abgegebene zählen nicht). Kommen während des Jahres
          Fahrzeuge dazu, wird nichts nachberechnet.
        </li>
      </ul>
      <p>
        Beide Abos haben dieselben Funktionen. Die Preise verstehen sich in Schweizer Franken. Der Anbieter ist nicht
        mehrwertsteuerpflichtig, darum enthalten die Rechnungen keine MWST.
      </p>
      <p>
        Die KI-Nutzung ist im Abo enthalten, im Rahmen normaler Nutzung. Gegen Missbrauch gelten technische Grenzen
        (Anfragen pro Minute und ein grosszügiges Monatskontingent), die bei gewöhnlichem Gebrauch nicht erreicht
        werden. Automatisierte Massenabfragen sind nicht erlaubt.
      </p>

      <h2>6. Rechnung und Zahlung</h2>
      <p>
        Das Abo wird im Voraus für ein Jahr in Rechnung gestellt. Die Rechnung kommt per E-Mail und ist innert 30 Tagen
        zahlbar. Nach der Bestellung kannst du sofort weiterarbeiten.
        Bestellst du während der Testzeit, beginnt das bezahlte Jahr erst an deren Ende.
      </p>
      <p>
        Bleibt eine Rechnung nach Fälligkeit und einer Mahnung unbezahlt, können wir KI-Scan und Chat sperren, bis
        die Zahlung eingeht. Deine Daten bleiben lesbar und exportierbar.
      </p>

      <h2>7. Laufzeit, Verlängerung und Kündigung</h2>
      <p>
        Das Abo läuft ein Jahr und verlängert sich automatisch um ein weiteres Jahr, wenn du es nicht kündigst.
        Die Rechnung für das nächste Jahr kommt 30 Tage vor Ablauf.
      </p>
      <p>
        Du kannst jederzeit kündigen, bis zum letzten Tag der Laufzeit ohne Frist: in der App unter Einstellungen
        («Abo kündigen») oder per E-Mail an <a :href="`mailto:${CONTACT_EMAIL}`">{{ CONTACT_EMAIL }}</a>. Das Abo
        läuft dann bis zum Ende des bezahlten Jahres weiter. Eine Rechnung für ein Jahr, das noch nicht begonnen hat,
        wird mit der Kündigung storniert. Für ein angebrochenes Jahr gibt es keine anteilige Rückerstattung.
      </p>
      <p>
        Wir können das Abo mit einer Frist von drei Monaten auf das Ende der Laufzeit kündigen, aus wichtigem Grund
        (z. B. Missbrauch oder wiederholter Zahlungsverzug) sofort. Stellen wir Wartungsheft ganz ein, erstatten wir
        bereits bezahlte Beträge für die restliche Laufzeit anteilig zurück.
      </p>

      <h2>8. Preisänderungen</h2>
      <p>
        Preisänderungen kündigen wir mindestens 60 Tage vor der nächsten Verlängerung per E-Mail an. Sie gelten ab der
        folgenden Laufzeit. Bist du nicht einverstanden, kündigst du bis zum Ablauf, wie in Ziffer 7 beschrieben.
      </p>

      <h2>9. Deine Daten</h2>
      <p>
        Die Daten, die du erfasst, gehören dir. Du kannst sie jederzeit exportieren (CSV, PDF und vollständiger
        Export in den Einstellungen), auch ohne Abo. Wir erstellen täglich Sicherungskopien. Wichtige Unterlagen
        solltest du trotzdem selbst aufbewahren, etwa als Export oder als Original.
      </p>
      <p>
        Dein Konto löschst du selbst in den Einstellungen («Konto löschen»), mit allen Fahrzeugen, Rechnungen und
        Belegen, sofort und endgültig; oder du schreibst an <a :href="`mailto:${CONTACT_EMAIL}`">{{ CONTACT_EMAIL }}</a>,
        dann erledigen wir es. Rechnungen, die wir dir gestellt haben, bewahren wir
        so lange auf, wie das Gesetz es verlangt. Wie wir mit Personendaten umgehen, steht in der
        <router-link to="/datenschutz">
          Datenschutzerklärung
        </router-link>.
      </p>

      <h2>10. Pflichten bei der Nutzung</h2>
      <ul>
        <li>Lade nur Inhalte hoch, zu denen du berechtigt bist, und keine rechtswidrigen Inhalte.</li>
        <li>Versuche nicht, Sicherheitsmassnahmen oder die Grenzen der KI-Nutzung zu umgehen.</li>
        <li>Gib keine fremden Zugänge weiter und nutze keine fremden Konten.</li>
      </ul>

      <h2>11. Verfügbarkeit</h2>
      <p>
        Wir sorgen für einen möglichst unterbrechungsfreien Betrieb, können ihn aber nicht garantieren. Wartungen,
        Störungen bei Dritten (Hosting, E-Mail, KI-Anbieter) oder höhere Gewalt können die App vorübergehend
        einschränken. Grössere geplante Unterbrüche kündigen wir wenn möglich vorher an.
      </p>

      <h2>12. Haftung</h2>
      <p>
        Wir haften für Schäden, die wir absichtlich oder grobfahrlässig verursachen. Die Haftung für leichte
        Fahrlässigkeit ist ausgeschlossen, soweit das Gesetz dies zulässt. Ausgeschlossen ist insbesondere die Haftung
        für Folgeschäden aus falsch ausgelesenen Werten, verpassten Fälligkeiten oder Terminen sowie für entgangenen
        Gewinn. In jedem Fall ist die Haftung auf den Betrag begrenzt, den du in den letzten zwölf Monaten für
        Wartungsheft bezahlt hast. Zwingende gesetzliche Haftung, etwa für Personenschäden, bleibt vorbehalten.
      </p>

      <h2>13. Änderungen dieser AGB</h2>
      <p>
        Änderungen teilen wir mindestens 30 Tage vor Inkrafttreten per E-Mail mit. Bist du nicht einverstanden, kannst
        du das Abo auf das Inkrafttreten hin kündigen; bereits bezahlte Beträge für die restliche Laufzeit erstatten wir
        dann anteilig zurück. Nutzt du Wartungsheft danach weiter, gelten die neuen AGB.
      </p>

      <h2>14. Anwendbares Recht und Gerichtsstand</h2>
      <p>
        Es gilt Schweizer Recht unter Ausschluss des Wiener Kaufrechts. Gerichtsstand ist der Sitz des Anbieters in
        Steinach SG. Für Konsumentinnen und Konsumenten gelten die zwingenden Gerichtsstände der Zivilprozessordnung.
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

/* «Geschäftsbedingungen» ist auf 390px breiter als die Seite: kleiner und mit Silbentrennung */
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

.legal-content p,
.legal-content li {
  color: var(--p-text-muted-color);
  line-height: 1.7;
}

.legal-content p {
  margin: 0 0 1rem;
}

.legal-content ul {
  margin: 0 0 1rem;
  padding-left: 1.25rem;
}

.legal-content a {
  color: var(--p-primary-color);
}
</style>
