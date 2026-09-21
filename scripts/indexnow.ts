/**
 * Meldet alle Seiten aus public/sitemap.xml per IndexNow an Bing und die anderen beteiligten Suchmaschinen
 * (src/services/indexnow.ts). Aufruf nach einem Deploy, der Texte der öffentlichen Seiten ändert oder eine Seite
 * hinzufügt: `npm run indexnow`. Nicht bei jedem Deploy, unveränderte Seiten wiederholt zu melden gilt als Spam.
 * Option --dry-run zeigt nur den JSON-Körper.
 */
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { indexNowRequest, sitemapUrls } from '../src/services/indexnow'

const body = indexNowRequest(sitemapUrls(readFileSync('public/sitemap.xml', 'utf8')))

if (process.argv.includes('--dry-run')) {
  console.log(JSON.stringify(body, null, 2))
}
else {
  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  })
  // 200 = angenommen, 202 = angenommen, Schlüssel wird noch geprüft
  console.log(`IndexNow ${response.status} für ${body.urlList.length} URLs`)
  if (response.status !== 200 && response.status !== 202) {
    console.error(await response.text())
    process.exit(1)
  }
}
