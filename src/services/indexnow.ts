/**
 * IndexNow (indexnow.org): meldet geänderte Seiten an Bing und die anderen beteiligten Suchmaschinen, ChatGPT
 * sucht über den Bing-Index. Der Schlüssel ist öffentlich, er liegt als `public/<Schlüssel>.txt` im Wurzelverzeichnis
 * und beweist, dass die Meldung vom Betreiber der Domain kommt. Versand: `scripts/indexnow.ts`.
 */

export const INDEXNOW_KEY = 'd9c1d07e1c75de51f3802f8c1a430533'
export const SITE_HOST = 'wartungsheft.ch'

export interface IndexNowRequest {
  host: string
  key: string
  keyLocation: string
  urlList: string[]
}

export function sitemapUrls(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]!.trim())
}

export function indexNowRequest(urls: string[]): IndexNowRequest {
  const foreign = urls.filter(url => new URL(url).host !== SITE_HOST)
  if (foreign.length)
    throw new Error(`IndexNow nimmt nur URLs von ${SITE_HOST}: ${foreign.join(', ')}`)
  return {
    host: SITE_HOST,
    key: INDEXNOW_KEY,
    keyLocation: `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  }
}
