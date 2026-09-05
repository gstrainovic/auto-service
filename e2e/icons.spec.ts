import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from './fixtures/test-fixtures'

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory())
      collectFiles(full, out)
    else if (/\.(?:vue|ts)$/.test(entry))
      out.push(full)
  }
  return out
}

test.describe('Icons', () => {
  test('IC-001: all used pi-* classes exist in PrimeIcons', async () => {
    const css = readFileSync('node_modules/primeicons/primeicons.css', 'utf8')
    const available = new Set(css.match(/\.pi-[a-z0-9-]+/g)?.map(s => s.slice(1)))

    const missing = new Set<string>()
    for (const file of collectFiles('src')) {
      const src = readFileSync(file, 'utf8')
      for (const icon of src.match(/\bpi-[a-z0-9-]+/g) ?? []) {
        if (!available.has(icon))
          missing.add(`${icon} (${file})`)
      }
    }

    expect([...missing]).toEqual([])
  })
})
