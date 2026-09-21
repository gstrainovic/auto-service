/**
 * Titel und Beschreibung pro öffentlicher Seite, einzige Quelle für den Kopf der HTML-Seite. Der Router setzt sie
 * im Browser (`applyMetaToDocument` in `page-meta-document.ts`), das Vite-Plugin in `vite.config.ts` schreibt beim Build `dist/<pfad>/index.html`
 * mit demselben Kopf, damit Crawler ohne JavaScript (search.ch, GPTBot) pro Seite den richtigen Titel sehen.
 * «Serviceheft» ist das geläufige Schweizer Wort (business-plan/05 Kanal 1), «Werkstattrechnung» statt «Garagenrechnung».
 * Bewusst ohne Browser- und Vite-Abhängigkeit, `vite.config.ts` importiert die Datei.
 */

export interface PageMeta {
  title: string
  description: string
}

export const SITE_URL = 'https://wartungsheft.ch'

export const PAGE_META: Record<string, PageMeta> = {
  '/': {
    title: 'Wartungsheft: digitales Serviceheft fürs Auto in der Schweiz',
    // Ein Satz, der «Was ist wartungsheft.ch?» beantwortet: Suchmaschinen und KI-Antworten zitieren ihn
    description: 'Wartungsheft ist das digitale Serviceheft aus der Schweiz: Werkstattrechnung fotografieren, Service und MFK im Blick. Privat 25, Betrieb 36 CHF pro Fahrzeug.',
  },
  '/privathalter': {
    title: 'Serviceheft-App fürs Auto: Rechnung fotografieren | Wartungsheft',
    description: 'Dein Serviceheft auf dem Handy: Werkstattrechnung fotografieren, Erinnerung vor Service und MFK, lückenlose Historie beim Verkauf. 25 CHF im Jahr.',
  },
  '/betrieb': {
    title: 'Fuhrpark-App: Serviceheft pro Firmenfahrzeug | Wartungsheft',
    description: 'Digitales Serviceheft für Firmenfahrzeuge: Werkstattrechnung fotografieren, Service und MFK pro Fahrzeug, Kosten für den Treuhänder. 36 CHF pro Fahrzeug.',
  },
  '/hilfe': {
    title: 'Hilfe: digitales Serviceheft führen | Wartungsheft',
    description: 'So führst du dein Serviceheft mit Wartungsheft: Fahrzeug erfassen, Rechnung fotografieren, Intervalle hinterlegen, Kosten exportieren, Fahrzeug verkaufen.',
  },
}

export function pageMeta(path: string): PageMeta & { canonical: string } {
  const known = PAGE_META[path]
  return known
    ? { ...known, canonical: `${SITE_URL}${path}` }
    : { ...PAGE_META['/']!, canonical: `${SITE_URL}/` }
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function setTag(html: string, pattern: RegExp, tag: string): string {
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `    ${tag}\n  </head>`)
}

export function applyMetaToHtml(html: string, path: string): string {
  const meta = pageMeta(path)
  const title = escapeAttr(meta.title)
  const description = escapeAttr(meta.description)
  let out = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
  out = setTag(out, /<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${description}" />`)
  out = setTag(out, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${title}" />`)
  out = setTag(out, /<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${description}" />`)
  out = setTag(out, /<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${meta.canonical}" />`)
  out = setTag(out, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${meta.canonical}" />`)
  return out
}
