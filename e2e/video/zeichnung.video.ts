/**
 * Gezeichnete Szenen und Titelkarten statt Filmaufnahmen: lädt die HTML-Dateien aus `video-scripts/szenen/`
 * und zeichnet die CSS-Animation auf. Kein fremdes Material, keine Lizenzfrage, nach einer Textänderung in
 * Sekunden neu aufgenommen — derselbe Weg wie bei den App-Clips.
 *
 *   npm run video -- e2e/video/zeichnung.video.ts
 *   scripts/video-clips.sh      # sammelt die Clips nach video-out/
 *   scripts/video-build.sh      # montiert daraus den Film
 */
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { expect, test } from '../fixtures/test-fixtures'
import { clipSpeichern } from './szenen'

/** Die Animationen laufen etwa 4 Sekunden; der Rest ist Standbild für den Schnitt */
const LAUFZEIT = 6500
const TITELZEIT = 4500

test.afterEach(async ({ page }, testInfo) => {
  await clipSpeichern(page, testInfo)
})

function szeneUrl(datei: string, query = ''): string {
  return pathToFileURL(`${process.cwd()}/video-scripts/szenen/${datei}`).href + query
}

const SZENEN: { name: string, datei: string, query?: string }[] = [
  { name: 'Szene privat: Kaeufer fragt nach dem Serviceheft', datei: 'privat-kaeufer.html' },
  { name: 'Szene privat: Kaeufer bekommt die Antwort', datei: 'privat-kaeufer.html', query: '?antwort=1' },
  { name: 'Szene privat: Zettelwirtschaft in der Schachtel', datei: 'privat-problem.html' },
  { name: 'Szene Betrieb: welcher Lieferwagen ist ueberfaellig', datei: 'betrieb-problem.html' },
]

/** Titelkarten; der Dateiname im Schnitt ergibt sich aus dem Testnamen */
const TITEL = [
  { name: 'Titel 1: Rechnung fotografieren', t: 'Rechnung fotografieren', s: 'Werkstatt, Datum, Betrag und Arbeiten stehen drin.' },
  { name: 'Titel 2: Wartungsheft rechnet mit', t: 'Wartungsheft rechnet mit', s: 'Was fällig ist, meldet sich von selbst.' },
  { name: 'Titel 3: Lueckenloses Serviceheft', t: 'Lückenloses Serviceheft', s: 'Beim Verkauf ein Klick zum PDF.' },
  { name: 'Titel 4: Preis privat', t: '25 Franken im Jahr', s: 'Bis fünf Fahrzeuge. Keine Werbung, Daten in der Schweiz.' },
  { name: 'Titel 5: Preis Betrieb', t: '36 Franken pro Fahrzeug', s: 'Im Jahr, Rechnung auf die Firma.' },
  { name: 'Titel 6: Abspann', t: '30 Tage gratis testen', s: 'wartungsheft.ch' },
]

for (const szene of SZENEN) {
  test(szene.name, async ({ page }) => {
    await page.goto(szeneUrl(szene.datei, szene.query))
    await expect(page.locator('.title')).toBeVisible()
    await page.waitForTimeout(LAUFZEIT)
  })
}

for (const karte of TITEL) {
  test(karte.name, async ({ page }) => {
    await page.goto(szeneUrl('titel.html', `?t=${encodeURIComponent(karte.t)}&s=${encodeURIComponent(karte.s)}`))
    await expect(page.locator('h1')).toHaveText(karte.t)
    await page.waitForTimeout(TITELZEIT)
  })
}
