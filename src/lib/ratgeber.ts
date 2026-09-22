/**
 * Ratgeber-Artikel als fertiges HTML: Markdown aus `content/ratgeber/<adresse>.md` wird beim Build zu
 * `dist/ratgeber/<adresse>/index.html` (Vite-Plugin in `vite.config.ts`). Anders als die App-Seiten brauchen diese
 * Seiten kein JavaScript, damit Suchmaschinen und KI-Crawler den ganzen Text lesen. Bewusst ohne Browser- und
 * Vite-Abhängigkeit, `vite.config.ts` importiert die Datei.
 */
import { marked } from 'marked'
import { formatDate } from './locale.ts'
import { SITE_URL } from './page-meta.ts'

export interface Article {
  slug: string
  title: string
  description: string
  date: string
  body: string
}

/** Kampagne in `CAMPAIGNS` (src/stores/events.ts): zählt den Weg vom Artikel in die Testzeit. */
const CTA_PATH = '/ratgeber-test'

export function parseArticle(slug: string, source: string): Article {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(source)
  const head: Record<string, string> = {}
  for (const line of (match?.[1] ?? '').split('\n')) {
    const i = line.indexOf(':')
    if (i > 0)
      head[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  for (const key of ['title', 'description', 'date']) {
    if (!head[key])
      throw new Error(`Ratgeber ${slug}: ${key} fehlt im Kopf`)
  }
  return { slug, title: head.title!, description: head.description!, date: head.date!, body: (match?.[2] ?? '').trim() }
}

function escape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const STYLE = `
  :root { color-scheme: light dark; --accent: #059669; --text: #1f2937; --muted: #6b7280; --bg: #ffffff; --soft: #ecfdf5; }
  @media (prefers-color-scheme: dark) { :root { --text: #e5e7eb; --muted: #9ca3af; --bg: #111827; --soft: #064e3b; } }
  * { box-sizing: border-box; }
  body { margin: 0; font: 17px/1.65 system-ui, -apple-system, 'Segoe UI', sans-serif; color: var(--text); background: var(--bg); }
  header, main, footer { max-width: 44rem; margin: 0 auto; padding: 0 16px; }
  header { display: flex; align-items: center; justify-content: space-between; padding-top: 16px; padding-bottom: 16px; }
  header a.brand { display: flex; align-items: center; gap: 8px; color: var(--text); text-decoration: none; font-weight: 700; }
  header img { width: 32px; height: 32px; }
  a { color: var(--accent); }
  h1 { font-size: 1.9rem; line-height: 1.25; margin: 1.5rem 0 0.5rem; }
  h2 { font-size: 1.3rem; margin-top: 2rem; }
  .meta { color: var(--muted); font-size: 0.9rem; }
  .cta { background: var(--soft); border-radius: 12px; padding: 20px; margin: 2.5rem 0; }
  .cta p { margin: 0 0 12px; }
  .button { display: inline-block; background: var(--accent); color: #fff; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: 600; }
  ul.list { padding: 0; list-style: none; }
  ul.list li { margin: 0 0 1.5rem; }
  footer { color: var(--muted); font-size: 0.9rem; padding-top: 24px; padding-bottom: 32px; }
`

function page(opts: { title: string, description: string, path: string, jsonLd: object, content: string }): string {
  const canonical = `${SITE_URL}${opts.path}`
  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escape(opts.title)}</title>
    <meta name="description" content="${escape(opts.description)}" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:title" content="${escape(opts.title)}" />
    <meta property="og:description" content="${escape(opts.description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:type" content="article" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <script type="application/ld+json">
${JSON.stringify(opts.jsonLd, null, 2)}
    </script>
    <style>${STYLE}</style>
  </head>
  <body>
    <header>
      <a class="brand" href="/"><img src="/favicon.svg" alt="" />Wartungsheft</a>
      <a href="/ratgeber">Ratgeber</a>
    </header>
    <main>
${opts.content}
    </main>
    <footer>
      <a href="/">Wartungsheft</a> · <a href="/hilfe">Hilfe</a> · <a href="/impressum">Impressum</a> ·
      <a href="mailto:info@wartungsheft.ch">info@wartungsheft.ch</a>
    </footer>
  </body>
</html>
`
}

export function renderArticlePage(article: Article): string {
  const path = `/ratgeber/${article.slug}`
  const content = `      <article>
        <h1>${escape(article.title)}</h1>
        <p class="meta">${formatDate(article.date)}</p>
${marked.parse(article.body, { async: false })}
      </article>
      <aside class="cta">
        <p><strong>Serviceheft auf dem Handy:</strong> Werkstattrechnung fotografieren, Wartungsheft trägt Datum,
        Kilometerstand und Arbeiten ein und erinnert vor Service und MFK.</p>
        <a class="button" href="${CTA_PATH}">30 Tage gratis testen</a>
      </aside>`
  return page({
    title: `${article.title} | Wartungsheft`,
    description: article.description,
    path,
    content,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      'headline': article.title,
      'description': article.description,
      'datePublished': article.date,
      'inLanguage': 'de-CH',
      'mainEntityOfPage': `${SITE_URL}${path}`,
      'publisher': { '@type': 'Organization', 'name': 'Wartungsheft', 'url': SITE_URL },
    },
  })
}

function newestFirst(articles: Article[]): Article[] {
  return [...articles].sort((a, b) => b.date.localeCompare(a.date))
}

export function renderIndexPage(articles: Article[]): string {
  const items = newestFirst(articles).map(a => `        <li>
          <a href="/ratgeber/${a.slug}"><strong>${escape(a.title)}</strong></a><br />
          ${escape(a.description)}
        </li>`).join('\n')
  return page({
    title: 'Ratgeber: Serviceheft, Wartung und Occasion | Wartungsheft',
    description: 'Ratgeber für Autohalter in der Schweiz: Serviceheft führen, Wartung planen, Occasion verkaufen.',
    path: '/ratgeber',
    content: `      <h1>Ratgeber</h1>
      <ul class="list">
${items}
      </ul>`,
    jsonLd: { '@context': 'https://schema.org', '@type': 'CollectionPage', 'name': 'Wartungsheft Ratgeber', 'url': `${SITE_URL}/ratgeber` },
  })
}

export function sitemapWithArticles(sitemap: string, articles: Article[]): string {
  const entries = [
    `  <url>\n    <loc>${SITE_URL}/ratgeber</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
    ...newestFirst(articles).map(a =>
      `  <url>\n    <loc>${SITE_URL}/ratgeber/${a.slug}</loc>\n    <lastmod>${a.date}</lastmod>\n    <priority>0.7</priority>\n  </url>`),
  ]
  return sitemap.replace('</urlset>', `${entries.join('\n')}\n</urlset>`)
}
