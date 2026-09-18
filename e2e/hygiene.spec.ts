import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { expect, test } from './fixtures/test-fixtures'

function collectFiles(dir: string, exts: RegExp, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory())
      collectFiles(full, exts, out)
    else if (exts.test(entry))
      out.push(full)
  }
  return out
}

function readAll(files: string[]): string {
  return files.map(f => readFileSync(f, 'utf8')).join('\n')
}

test.describe('Hygiene', () => {
  test('HY-001: every runtime dependency is imported somewhere', async () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies: Record<string, string> }
    // Der AI-Proxy ist ein eigenes Paket (@strainovic/ai-proxy), geladen über npm run dev:proxy
    const files = [
      ...collectFiles('src', /\.(?:vue|ts|css)$/),
      'vite.config.ts',
      'index.html',
    ].filter(existsSync)
    const source = readAll(files)

    const unused = Object.keys(pkg.dependencies).filter((dep) => {
      const escaped = dep.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
      return !new RegExp(`['"]${escaped}(?:/[^'"]*)?['"]`).test(source)
    })

    expect(unused).toEqual([])
  })

  test('HY-002: every component in src/components is imported somewhere', async () => {
    const components = collectFiles('src/components', /\.vue$/)
    const source = readAll(collectFiles('src', /\.(?:vue|ts)$/))

    const unused = components.filter((file) => {
      const name = basename(file)
      const escaped = name.replace(/\./g, '\\.')
      const importedElsewhere = new RegExp(`from '[^']*/${escaped}'`, 'g')
      const hits = source.match(importedElsewhere) ?? []
      return hits.length === 0
    })

    expect(unused).toEqual([])
  })

  test('HY-003: no tooltip repeats the visible button label', async () => {
    const redundant: string[] = []
    for (const file of collectFiles('src', /\.vue$/)) {
      // Attributwerte in Anführungszeichen dürfen ">" enthalten (z. B. "() => …")
      for (const tag of readFileSync(file, 'utf8').match(/<Button\b(?:[^>"]|"[^"]*")*>/g) ?? []) {
        const tooltip = tag.match(/v-tooltip(?:\.\w+)*="'([^']*)'"/)?.[1]
        const label = tag.match(/\slabel="([^"]*)"/)?.[1]
        if (tooltip && tooltip === label)
          redundant.push(`${file}: ${label}`)
      }
    }

    expect(redundant).toEqual([])
  })
})
