import { describe, expect, it } from 'vitest'
import indexHtml from '../../index.html?raw'
import viteConfig from '../../vite.config.ts?raw'

const publicFiles = Object.keys(import.meta.glob('../../public/*.{png,svg,ico}'))
  .map(path => path.replace('../../public/', ''))

describe('app-icons', () => {
  it('jedes Icon im Manifest liegt in public/', () => {
    const icons = [...viteConfig.matchAll(/src: '([^']+)'/g)].map(match => match[1])
    expect(icons.length).toBeGreaterThan(0)
    for (const icon of icons)
      expect(publicFiles).toContain(icon)
  })

  it('favicon und apple-touch-icon sind die eigenen, nicht das Vite-Logo', () => {
    const links = [...indexHtml.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="\/([^"]+)"/g)].map(match => match[1])
    expect(links).toContain('favicon.svg')
    expect(links).toContain('apple-touch-icon.png')
    for (const link of links)
      expect(publicFiles).toContain(link)
    expect(indexHtml).not.toContain('vite.svg')
  })
})
