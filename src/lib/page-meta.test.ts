import { describe, expect, it } from 'vitest'
import indexHtml from '../../index.html?raw'
import publicSitemap from '../../public/sitemap.xml?raw'
import { sitemapUrls } from '../services/indexnow'
import { applyMetaToHtml, PAGE_META, pageMeta, SITE_URL } from './page-meta'

describe('pageMeta', () => {
  it('hat für jede Seite der Sitemap eigenen Titel und eigene Beschreibung', () => {
    const paths = sitemapUrls(publicSitemap).map(url => new URL(url).pathname)
    for (const path of paths)
      expect(PAGE_META[path], path).toBeDefined()
    const titles = Object.values(PAGE_META).map(meta => meta.title)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('nennt auf den Einstiegsseiten das Schweizer Wort «Serviceheft»', () => {
    for (const path of ['/', '/privathalter', '/betrieb', '/hilfe']) {
      expect(PAGE_META[path]!.title, path).toMatch(/Serviceheft/)
      expect(PAGE_META[path]!.description, path).toMatch(/Serviceheft/)
    }
  })

  it('nennt auf Startseite und Privathalter-Seite «Servicebuch», das in der Schweiz meistgesuchte Wort', () => {
    for (const path of ['/', '/privathalter']) {
      expect(PAGE_META[path]!.title, path).toMatch(/Servicebuch/)
      expect(PAGE_META[path]!.description, path).toMatch(/Servicebuch/)
    }
  })

  it('hält Titel und Beschreibung in der Länge, die Google anzeigt', () => {
    for (const [path, meta] of Object.entries(PAGE_META)) {
      expect(meta.title.length, path).toBeLessThanOrEqual(65)
      expect(meta.description.length, path).toBeLessThanOrEqual(160)
    }
  })

  it('fällt für unbekannte Pfade auf die Startseite zurück, ohne kanonische Adresse auf den Pfad', () => {
    expect(pageMeta('/dashboard')).toEqual({ ...PAGE_META['/']!, canonical: `${SITE_URL}/` })
    expect(pageMeta('/betrieb').canonical).toBe(`${SITE_URL}/betrieb`)
  })
})

describe('applyMetaToHtml', () => {
  it('ersetzt Titel, Beschreibung und Open Graph und setzt die kanonische Adresse', () => {
    const html = applyMetaToHtml(indexHtml, '/betrieb')
    const meta = PAGE_META['/betrieb']!
    expect(html).toContain(`<title>${meta.title}</title>`)
    expect(html).toContain(`<meta name="description" content="${meta.description}" />`)
    expect(html).toContain(`<meta property="og:title" content="${meta.title}" />`)
    expect(html).toContain(`<meta property="og:description" content="${meta.description}" />`)
    expect(html).toContain(`<meta property="og:url" content="${SITE_URL}/betrieb" />`)
    expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/betrieb" />`)
    expect(html.match(/<title>/g)).toHaveLength(1)
    expect(html.match(/rel="canonical"/g)).toHaveLength(1)
  })

  it('lässt sich wiederholt anwenden, ohne Tags zu verdoppeln', () => {
    const twice = applyMetaToHtml(applyMetaToHtml(indexHtml, '/'), '/hilfe')
    expect(twice.match(/rel="canonical"/g)).toHaveLength(1)
    expect(twice.match(/property="og:url"/g)).toHaveLength(1)
    expect(twice).toContain(`<title>${PAGE_META['/hilfe']!.title}</title>`)
  })
})
