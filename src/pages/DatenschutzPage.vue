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
      <h1>Datenschutzerklärung</h1>
      <p class="legal-updated">
        Stand: Februar 2026
      </p>

      <h2>1. Verantwortliche Stelle</h2>
      <p>
        <strong>Goran Strainovic</strong><br>
        Strainovic IT (Einzelfirma)<br>
        9323 Steinach<br>
        Schweiz<br>
        E-Mail: <a href="mailto:info@strainovic-it.ch">info@strainovic-it.ch</a>
      </p>

      <h2>2. Grundsatz</h2>
      <p>
        Der Schutz Ihrer Personendaten ist uns ein wichtiges Anliegen. Wir bearbeiten
        Ihre Personendaten im Einklang mit dem Schweizer Datenschutzgesetz (DSG) und,
        soweit anwendbar, der EU-Datenschutz-Grundverordnung (DSGVO).
      </p>
      <p>
        Wir erheben nur die Daten, die für die Nutzung unserer App tatsächlich
        erforderlich sind.
      </p>

      <h2>3. Welche Daten wir erheben</h2>

      <h3>3.1 Kontodaten</h3>
      <ul>
        <li><strong>E-Mail-Adresse</strong> — für die Anmeldung via Magic Code</li>
      </ul>
      <p>Wir speichern kein Passwort. Die Authentifizierung erfolgt über Einmal-Codes per E-Mail.</p>

      <h3>3.2 Fahrzeugdaten</h3>
      <ul>
        <li>Marke, Modell, Jahrgang</li>
        <li>Kilometerstand</li>
        <li>Kontrollschild (Kennzeichen) und Fahrgestellnummer (VIN)</li>
      </ul>

      <h3>3.3 Rechnungs- und Wartungsdaten</h3>
      <ul>
        <li>Werkstattname, Datum, Betrag</li>
        <li>Einzelpositionen (Arbeiten und Teile)</li>
        <li>Hochgeladene Bilder und PDFs von Rechnungen</li>
      </ul>

      <h3>3.4 Technische Daten</h3>
      <ul>
        <li>IP-Adresse (Serverprotokolle, automatisch gelöscht nach 30 Tagen)</li>
        <li>Browser-Typ und -Version</li>
        <li>Keine Cookies zu Tracking-Zwecken</li>
      </ul>

      <h2>4. Zweck der Datenbearbeitung</h2>
      <table>
        <thead>
          <tr>
            <th>Daten</th>
            <th>Zweck</th>
            <th>Rechtsgrundlage</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>E-Mail</td>
            <td>Authentifizierung, Konto-Zugang</td>
            <td>Vertragserfüllung</td>
          </tr>
          <tr>
            <td>Fahrzeug-, Rechnungsdaten</td>
            <td>Kernfunktion: Wartungs-Tracking</td>
            <td>Vertragserfüllung</td>
          </tr>
          <tr>
            <td>Bilder / PDFs</td>
            <td>KI-gestützte Datenextraktion</td>
            <td>Einwilligung (Upload durch Nutzer)</td>
          </tr>
          <tr>
            <td>IP-Adresse</td>
            <td>Serversicherheit, Missbrauchsprävention</td>
            <td>Berechtigtes Interesse</td>
          </tr>
        </tbody>
      </table>

      <h2>5. KI-gestützte Verarbeitung</h2>
      <p>
        Auto-Service nutzt KI-Dienste zur Extraktion von Daten aus Rechnungsfotos und
        Dokumenten. Dabei werden Bilder an den vom Nutzer gewählten KI-Anbieter
        übermittelt:
      </p>
      <table>
        <thead>
          <tr>
            <th>Anbieter</th>
            <th>Standort</th>
            <th>Daten-Training</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Mistral AI</td>
            <td>Frankreich (EU)</td>
            <td>Opt-out möglich (Free Tier); kein Training (Scale Tier)</td>
          </tr>
          <tr>
            <td>Anthropic</td>
            <td>USA</td>
            <td>Kein Training mit API-Daten</td>
          </tr>
          <tr>
            <td>OpenAI</td>
            <td>USA</td>
            <td>Kein Training mit API-Daten (seit März 2023)</td>
          </tr>
          <tr>
            <td>Meta (via OpenRouter)</td>
            <td>USA</td>
            <td>Kein Training mit API-Daten</td>
          </tr>
          <tr>
            <td>Ollama (lokal)</td>
            <td>Ihr Gerät</td>
            <td>Keine Datenübermittlung</td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>Wichtig:</strong> Sie wählen den KI-Anbieter selbst in den Einstellungen.
        Wenn Sie maximalen Datenschutz wünschen, nutzen Sie Ollama — dabei verlassen
        keine Daten Ihr Gerät.
      </p>

      <h2>6. Datenspeicherung</h2>

      <h3>6.1 Datenbank</h3>
      <p>
        Ihre Daten werden in einer selbst gehosteten InstantDB-Instanz gespeichert.
        Der Server steht bei Hetzner in Deutschland (EU). Die Daten werden
        verschlüsselt übertragen (TLS).
      </p>

      <h3>6.2 Lokale Speicherung (Offline-Modus)</h3>
      <p>
        Für die Offline-Funktionalität werden Ihre Daten zusätzlich in der IndexedDB
        Ihres Browsers gespeichert. Diese Daten verlassen Ihr Gerät nicht und werden
        bei Deinstallation der App automatisch gelöscht.
      </p>

      <h3>6.3 Aufbewahrungsdauer</h3>
      <ul>
        <li><strong>Kontodaten:</strong> Bis zur Löschung Ihres Kontos</li>
        <li><strong>Fahrzeug-/Rechnungsdaten:</strong> Bis zur Löschung durch Sie</li>
        <li><strong>Server-Logs:</strong> 30 Tage</li>
        <li><strong>OCR-Cache:</strong> Bis zur Löschung der zugehörigen Rechnung</li>
      </ul>

      <h2>7. Weitergabe an Dritte</h2>
      <p>Wir verkaufen Ihre Daten nicht. Eine Weitergabe erfolgt ausschliesslich an:</p>
      <table>
        <thead>
          <tr>
            <th>Dienst</th>
            <th>Zweck</th>
            <th>Standort</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Hetzner</td>
            <td>Server-Hosting</td>
            <td>Deutschland (EU)</td>
          </tr>
          <tr>
            <td>Vercel</td>
            <td>Frontend-Hosting</td>
            <td>USA (Edge: global)</td>
          </tr>
          <tr>
            <td>Postmark</td>
            <td>E-Mail-Versand (Magic Codes)</td>
            <td>USA</td>
          </tr>
          <tr>
            <td>KI-Anbieter (nach Wahl)</td>
            <td>Bild-/Dokumentanalyse</td>
            <td>Siehe Abschnitt 5</td>
          </tr>
        </tbody>
      </table>
      <p>
        Für US-Anbieter gelten Standardvertragsklauseln (SCCs) als Grundlage
        für den Datentransfer.
      </p>

      <h2>8. Ihre Rechte</h2>
      <p>Nach dem Schweizer DSG und der DSGVO haben Sie folgende Rechte:</p>
      <ul>
        <li><strong>Auskunft:</strong> Sie können jederzeit Auskunft über Ihre gespeicherten Daten verlangen.</li>
        <li><strong>Berichtigung:</strong> Unrichtige Daten können Sie selbst korrigieren oder uns bitten, dies zu tun.</li>
        <li><strong>Löschung:</strong> Sie können Ihre Daten jederzeit selbst in der App löschen oder die Löschung Ihres Kontos verlangen.</li>
        <li><strong>Datenübertragbarkeit:</strong> Sie können Ihre Daten als Export (CSV/PDF) herunterladen.</li>
        <li><strong>Widerspruch:</strong> Sie können der Datenbearbeitung jederzeit widersprechen.</li>
      </ul>
      <p>
        Für die Ausübung Ihrer Rechte kontaktieren Sie uns unter der im Impressum
        angegebenen E-Mail-Adresse.
      </p>

      <h2>9. Aufsichtsbehörde</h2>
      <p>
        Zuständige Datenschutzbehörde in der Schweiz:<br>
        <strong>Eidgenössischer Datenschutz- und Öffentlichkeitsbeauftragter (EDÖB)</strong><br>
        Feldeggweg 1, 3003 Bern<br>
        <a href="https://www.edoeb.admin.ch" target="_blank" rel="noopener">www.edoeb.admin.ch</a>
      </p>

      <h2>10. Cookies</h2>
      <p>
        Auto-Service verwendet <strong>keine Tracking-Cookies</strong>.
        Es werden ausschliesslich technisch notwendige Daten im Browser gespeichert
        (localStorage für Einstellungen, IndexedDB für Offline-Daten).
      </p>

      <h2>11. Änderungen</h2>
      <p>
        Wir können diese Datenschutzerklärung jederzeit anpassen. Die aktuelle Version
        ist stets auf dieser Seite verfügbar. Bei wesentlichen Änderungen informieren
        wir registrierte Nutzer per E-Mail.
      </p>
    </main>

    <footer class="legal-footer">
      <div class="legal-container footer-inner">
        <router-link to="/">
          Startseite
        </router-link>
        <router-link to="/impressum">
          Impressum
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
  margin: 0 0 0.5rem;
}

.legal-updated {
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
  margin: 0 0 2rem;
}

.legal-content h2 {
  font-size: 1.4rem;
  font-weight: 600;
  margin: 2rem 0 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--p-surface-border);
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

.legal-content ul {
  color: var(--p-text-muted-color);
  line-height: 1.7;
  padding-left: 1.5rem;
  margin: 0 0 1rem;
}

.legal-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
  font-size: 0.9rem;
}

.legal-content th,
.legal-content td {
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--p-surface-border);
  text-align: left;
}

.legal-content th {
  background: var(--p-surface-card);
  font-weight: 600;
  color: var(--p-text-color);
}

.legal-content td {
  color: var(--p-text-muted-color);
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
