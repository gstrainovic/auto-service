/**
 * Herkunft am Datensatz (`source` an Fahrzeug, Rechnung, Wartung): über welchen Einstieg ein Eintrag entstand.
 * Ersetzt ein Analytics-Werkzeug für Fragen wie «wie viele Rechnungen kommen über den Chat»; Scan oder Handeingabe
 * zeigt bei Rechnungen schon `imageData`. Wartungen aus einer Rechnung erben die Herkunft der Rechnung.
 */
export type EntrySource
  = | 'chat'
    | 'formular' // Formular auf Fahrzeugliste oder Fahrzeugseite
    | 'stapel' // mehrere Fotos oder Sammel-PDF
    | 'wartungsplan' // «Eintragen» an einer Zeile des Wartungsplans
    | 'serviceheft' // Stempel aus dem Serviceheft-Scan
    | 'dashboard' // «Erledigt eintragen» und «Rechnung fotografieren» im Dashboard
