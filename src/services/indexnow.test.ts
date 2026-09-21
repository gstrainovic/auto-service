import { describe, expect, it } from 'vitest'
import publicSitemap from '../../public/sitemap.xml?raw'
import { INDEXNOW_KEY, indexNowRequest, sitemapUrls } from './indexnow'

const publicTextFiles = import.meta.glob<string>('../../public/*.txt', { query: '?raw', import: 'default', eager: true })

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://wartungsheft.ch/</loc>
    <priority>1.0</priority>
  </url>
  <url>
    <loc> https://wartungsheft.ch/betrieb </loc>
  </url>
</urlset>`

describe('sitemapUrls', () => {
  it('liest alle loc-Einträge der Sitemap', () => {
    expect(sitemapUrls(sitemap)).toEqual(['https://wartungsheft.ch/', 'https://wartungsheft.ch/betrieb'])
  })

  it('liest die echte Sitemap aus public/', () => {
    const urls = sitemapUrls(publicSitemap)
    expect(urls).toContain('https://wartungsheft.ch/privathalter')
    expect(urls.every(url => url.startsWith('https://wartungsheft.ch/'))).toBe(true)
  })
})

describe('indexNowRequest', () => {
  it('baut den JSON-Körper für eine Sammelmeldung', () => {
    expect(indexNowRequest(['https://wartungsheft.ch/'])).toEqual({
      host: 'wartungsheft.ch',
      key: INDEXNOW_KEY,
      keyLocation: `https://wartungsheft.ch/${INDEXNOW_KEY}.txt`,
      urlList: ['https://wartungsheft.ch/'],
    })
  })

  it('lehnt URLs anderer Hosts ab, IndexNow antwortet sonst mit 422', () => {
    expect(() => indexNowRequest(['https://example.com/'])).toThrow('example.com')
  })
})

describe('schlüsseldatei', () => {
  it('liegt im Wurzelverzeichnis und enthält genau den Schlüssel', () => {
    expect(INDEXNOW_KEY).toMatch(/^[a-z0-9-]{8,128}$/i)
    expect(publicTextFiles[`../../public/${INDEXNOW_KEY}.txt`]?.trim()).toBe(INDEXNOW_KEY)
  })
})
