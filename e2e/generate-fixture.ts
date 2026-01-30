import * as fs from 'node:fs'
import * as path from 'node:path'
import { chromium } from 'playwright'

async function main() {
  const dir = path.join(import.meta.dirname, 'fixtures')
  fs.mkdirSync(dir, { recursive: true })

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 800, height: 1000 } })

  await page.setContent(`
    <div style="font-family: Arial; padding: 40px; max-width: 600px; background: white;">
      <h1 style="margin-top:0">Autowerkstatt München GmbH</h1>
      <p>Leopoldstraße 42, 80802 München</p>
      <hr>
      <p><strong>Rechnung Nr:</strong> 2024-0847</p>
      <p><strong>Datum:</strong> 15.01.2025</p>
      <p><strong>Kunde:</strong> Max Mustermann</p>
      <p><strong>Fahrzeug:</strong> BMW 320d, M-AB 1234</p>
      <p><strong>Kilometerstand:</strong> 47.500 km</p>
      <hr>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #ccc;">
          <th style="text-align: left; padding: 8px;">Position</th>
          <th style="text-align: right; padding: 8px;">Betrag</th>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 8px;">Ölwechsel inkl. Motoröl 5W-30</td>
          <td style="text-align: right; padding: 8px;">89,90 €</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 8px;">Ölfilter wechseln</td>
          <td style="text-align: right; padding: 8px;">24,50 €</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 8px;">Bremsbeläge vorne erneuern</td>
          <td style="text-align: right; padding: 8px;">185,00 €</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 8px;">Arbeitszeit (2,5 Std.)</td>
          <td style="text-align: right; padding: 8px;">187,50 €</td>
        </tr>
        <tr style="font-weight: bold; border-top: 2px solid #000;">
          <td style="padding: 8px;">Gesamt (inkl. MwSt.)</td>
          <td style="text-align: right; padding: 8px;">486,90 €</td>
        </tr>
      </table>
      <hr>
      <p style="font-size: 12px;">Zahlbar innerhalb von 14 Tagen.</p>
    </div>
  `)

  const outputPath = path.join(dir, 'test-invoice.png')
  await page.screenshot({ path: outputPath, fullPage: true })
  await browser.close()
  // eslint-disable-next-line no-console
  console.log(`Created: ${outputPath}`)
}

main()
