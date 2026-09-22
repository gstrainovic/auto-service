import { describe, expect, it } from 'vitest'
import { parseArticle, renderArticlePage, renderIndexPage, sitemapWithArticles } from './ratgeber'

const SOURCE = `---
title: Serviceheft verloren: So baust du die Historie wieder auf
description: Was du tun kannst, wenn das Serviceheft weg ist.
date: 2026-09-23
---

Einleitung mit **fett**.

## Erster Schritt

Text & mehr.
`

describe('parseArticle', () => {
  it('liest Kopf und Text, der Dateiname ist die Adresse', () => {
    const article = parseArticle('serviceheft-verloren', SOURCE)
    expect(article.slug).toBe('serviceheft-verloren')
    expect(article.title).toBe('Serviceheft verloren: So baust du die Historie wieder auf')
    expect(article.description).toBe('Was du tun kannst, wenn das Serviceheft weg ist.')
    expect(article.date).toBe('2026-09-23')
    expect(article.body).toContain('## Erster Schritt')
  })

  it('verlangt Titel, Beschreibung und Datum', () => {
    expect(() => parseArticle('x', '---\ntitle: T\n---\nText')).toThrow(/description/)
  })
})

describe('renderArticlePage', () => {
  const html = renderArticlePage(parseArticle('serviceheft-verloren', SOURCE))

  it('liefert fertiges HTML mit Kopf für Suchmaschinen', () => {
    expect(html).toContain('<html lang="de">')
    expect(html).toContain('<title>Serviceheft verloren: So baust du die Historie wieder auf | Wartungsheft</title>')
    expect(html).toContain('<meta name="description" content="Was du tun kannst, wenn das Serviceheft weg ist." />')
    expect(html).toContain('<link rel="canonical" href="https://wartungsheft.ch/ratgeber/serviceheft-verloren" />')
    expect(html).toContain('"@type": "Article"')
  })

  it('zeigt Überschrift, Text und Datum im Schweizer Format', () => {
    expect(html).toContain('<h1>Serviceheft verloren: So baust du die Historie wieder auf</h1>')
    expect(html).toContain('<strong>fett</strong>')
    expect(html).toContain('<h2')
    expect(html).toContain('Text &amp; mehr.')
    expect(html).toContain('23.09.2026')
  })

  it('führt über die Ratgeber-Adresse in die Testzeit', () => {
    expect(html).toContain('href="/ratgeber-test"')
    expect(html).toContain('30 Tage gratis testen')
  })
})

describe('renderIndexPage', () => {
  it('listet die Artikel, neueste zuerst', () => {
    const older = parseArticle('alt', SOURCE.replace('2026-09-23', '2026-01-01').replace('Serviceheft verloren', 'Alt'))
    const newer = parseArticle('neu', SOURCE)
    const html = renderIndexPage([older, newer])
    expect(html).toContain('<link rel="canonical" href="https://wartungsheft.ch/ratgeber" />')
    expect(html.indexOf('/ratgeber/neu')).toBeLessThan(html.indexOf('/ratgeber/alt'))
  })
})

describe('sitemapWithArticles', () => {
  it('hängt Übersicht und Artikel vor dem Schluss an', () => {
    const sitemap = '<urlset>\n  <url><loc>https://wartungsheft.ch/</loc></url>\n</urlset>\n'
    const out = sitemapWithArticles(sitemap, [parseArticle('serviceheft-verloren', SOURCE)])
    expect(out).toContain('<loc>https://wartungsheft.ch/ratgeber</loc>')
    expect(out).toContain('<loc>https://wartungsheft.ch/ratgeber/serviceheft-verloren</loc>')
    expect(out).toContain('<lastmod>2026-09-23</lastmod>')
    expect(out.trim().endsWith('</urlset>')).toBe(true)
  })
})
