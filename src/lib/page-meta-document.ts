import { pageMeta } from './page-meta'

/** Im Browser nach jedem Seitenwechsel, gleiche Angaben wie `applyMetaToHtml` */
export function applyMetaToDocument(doc: Document, path: string): void {
  const meta = pageMeta(path)
  doc.title = meta.title
  const set = (selector: string, attr: string, value: string, create: () => HTMLElement) => {
    let el = doc.head.querySelector(selector)
    if (!el) {
      el = create()
      doc.head.appendChild(el)
    }
    el.setAttribute(attr, value)
  }
  const metaTag = (key: 'name' | 'property', name: string) => () => {
    const el = doc.createElement('meta')
    el.setAttribute(key, name)
    return el
  }
  set('meta[name="description"]', 'content', meta.description, metaTag('name', 'description'))
  set('meta[property="og:title"]', 'content', meta.title, metaTag('property', 'og:title'))
  set('meta[property="og:description"]', 'content', meta.description, metaTag('property', 'og:description'))
  set('meta[property="og:url"]', 'content', meta.canonical, metaTag('property', 'og:url'))
  set('link[rel="canonical"]', 'href', meta.canonical, () => {
    const el = doc.createElement('link')
    el.setAttribute('rel', 'canonical')
    return el
  })
}
