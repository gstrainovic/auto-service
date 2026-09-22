/**
 * Rendert die öffentlichen Einstiegsseiten nach `npm run build` in Chromium und schreibt das fertige HTML nach dist/,
 * damit Crawler ohne JavaScript den Text sehen (src/lib/prerender.ts). Aufruf: `npm run prerender`, im Deploy nach
 * dem Build. Die Seiten sprechen dabei mit der InstantDB aus .env.production, wie ein abgemeldeter Besucher.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'
import { preview } from 'vite'
import { markPrerendered, PRERENDER_PATHS, prerenderFile } from '../src/lib/prerender.ts'

const server = await preview({ preview: { port: 4174, strictPort: true }, logLevel: 'warn' })
const browser = await chromium.launch()
let failed = false
try {
  // Startseite zuletzt: index.html ist zugleich der SPA-Rückfall, über den der Vorschau-Server die anderen Seiten lädt
  for (const path of [...PRERENDER_PATHS.filter(p => p !== '/'), '/']) {
    // Frischer Kontext pro Seite: kein bekanntes Konto, kein Service Worker aus der vorherigen Seite
    const context = await browser.newContext({ serviceWorkers: 'block' })
    const page = await context.newPage()
    await page.goto(`http://localhost:4174${path}`)
    await page.locator('#app h1').first().waitFor({ timeout: 30000 })
    // Bilder, Preise und Film-Poster brauchen einen Moment nach der Überschrift
    await page.waitForTimeout(1500)
    const html = markPrerendered(await page.content(), path)
    const words = ((await page.locator('#app').textContent()) ?? '').split(/\s+/).length
    writeFileSync(join('dist', prerenderFile(path)), html)
    console.log(`prerender ${path}: ${words} Wörter`)
    if (words < 50)
      failed = true
    await context.close()
  }
}
finally {
  await browser.close()
  server.httpServer.close()
}
if (failed) {
  console.error('prerender: eine Seite hat kaum Text, vermutlich nicht fertig gerendert')
  process.exit(1)
}
