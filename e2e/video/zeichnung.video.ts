/**
 * Gezeichnete Szenen statt Filmaufnahmen: lädt die HTML-Dateien aus `video-scripts/szenen/` und zeichnet die
 * CSS-Animation auf. Kein fremdes Material, keine Lizenzfrage, nach einer Textänderung in Sekunden neu
 * aufgenommen — derselbe Weg wie bei den App-Clips.
 *
 *   npm run video -- e2e/video/zeichnung.video.ts
 *   scripts/video-clips.sh
 */
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { expect, test } from '../fixtures/test-fixtures'

/** Die Animationen laufen etwa 4 Sekunden; der Rest ist Standbild für den Schnitt */
const LAUFZEIT = 6500

const SZENEN = [
  { name: 'Szene 1 privat: Zettelwirtschaft in der Schachtel', datei: 'privat-problem.html' },
  { name: 'Szene 1 Betrieb: welcher Bus ist überfällig', datei: 'betrieb-problem.html' },
]

for (const szene of SZENEN) {
  test(szene.name, async ({ page }) => {
    await page.goto(pathToFileURL(`${process.cwd()}/video-scripts/szenen/${szene.datei}`).href)
    await expect(page.locator('.title')).toBeVisible()
    await page.waitForTimeout(LAUFZEIT)
  })
}
