/**
 * Vorgerenderte Einstiegsseiten: `scripts/prerender.ts` öffnet nach dem Build jede Seite in Chromium und speichert das
 * fertige HTML, damit Crawler ohne JavaScript (GPTBot, ClaudeBot, PerplexityBot) den Text lesen. Die App startet
 * darüber wie gewohnt und ersetzt den Inhalt beim Mount. Bewusst ohne Browser- und Vite-Abhängigkeit, `vite.config.ts`
 * importiert die Datei.
 */
import { PAGE_META } from './page-meta.ts'

export const PRERENDER_PATHS = Object.keys(PAGE_META)

export function prerenderFile(path: string): string {
  return path === '/' ? 'index.html' : `${path.slice(1)}/index.html`
}

export function markPrerendered(html: string, path: string): string {
  const meta = `<meta name="prerendered-path" content="${path}" />`
  const cleaned = html
    .replace(/<meta name="prerendered-path" content="[^"]*" ?\/?>/g, '')
    .replace(/(<html[^>]*?) class="[^"]*"/, '$1')
  return cleaned.replace('<head>', `<head>${meta}`)
}

/**
 * Soll der vorgerenderte Inhalt bis zum Mount der App versteckt bleiben? Ja, wenn die Datei als SPA-Rückfall für eine
 * andere Adresse dient (index.html für /dashboard) oder ein bekanntes Konto gleich weitergeleitet wird. Läuft als
 * Inline-Skript im Kopf (`vite.config.ts` setzt `toString()` ein), darum ohne Importe und ohne Typ-Syntax im Rumpf.
 */
export function hidePrerendered(prerendered: string | null, pathname: string, knownAccount: boolean): boolean {
  if (!prerendered)
    return false
  const current = pathname.replace(/\/+$/, '') || '/'
  // Nur die Startseite leitet angemeldete Konten ins Dashboard weiter (src/router/index.ts)
  return current !== prerendered || (knownAccount && current === '/')
}
