import * as fs from 'node:fs'
import * as path from 'node:path'
import { chromium } from 'playwright'

const dir = path.join(import.meta.dirname, 'fixtures')

async function generatePage(html: string, filename: string, height = 1000) {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 800, height } })
  await page.setContent(html)
  const outputPath = path.join(dir, filename)
  await page.screenshot({ path: outputPath, fullPage: true })
  await browser.close()
  // eslint-disable-next-line no-console
  console.log(`Created: ${outputPath}`)
}

async function main() {
  fs.mkdirSync(dir, { recursive: true })

  // 1. Rechnung (existing)
  await generatePage(`
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
  `, 'test-invoice.png')

  // 2. Kaufvertrag
  await generatePage(`
    <div style="font-family: Arial; padding: 40px; max-width: 600px; background: white;">
      <h1 style="margin-top:0; text-align: center;">Kaufvertrag über ein gebrauchtes Kraftfahrzeug</h1>
      <hr>
      <h3>Verkäufer</h3>
      <p>Hans Schmidt, Berliner Str. 15, 10115 Berlin</p>
      <h3>Käufer</h3>
      <p>Max Mustermann, Hauptstr. 7, 80331 München</p>
      <hr>
      <h3>Fahrzeugdaten</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 6px; width: 200px;"><strong>Marke:</strong></td><td style="padding: 6px;">Volkswagen</td></tr>
        <tr><td style="padding: 6px;"><strong>Modell:</strong></td><td style="padding: 6px;">Golf VIII</td></tr>
        <tr><td style="padding: 6px;"><strong>Erstzulassung:</strong></td><td style="padding: 6px;">03/2021</td></tr>
        <tr><td style="padding: 6px;"><strong>Fahrgestellnummer:</strong></td><td style="padding: 6px;">WVWZZZ1KZMP012345</td></tr>
        <tr><td style="padding: 6px;"><strong>Kennzeichen:</strong></td><td style="padding: 6px;">B-HS 4321</td></tr>
        <tr><td style="padding: 6px;"><strong>Kilometerstand:</strong></td><td style="padding: 6px;">38.500 km</td></tr>
        <tr><td style="padding: 6px;"><strong>Motorart:</strong></td><td style="padding: 6px;">Benzin</td></tr>
        <tr><td style="padding: 6px;"><strong>Leistung:</strong></td><td style="padding: 6px;">110 kW / 150 PS</td></tr>
      </table>
      <hr>
      <h3>Kaufpreis</h3>
      <p style="font-size: 18px;"><strong>22.500,00 €</strong> (in Worten: zweiundzwanzigtausendfünfhundert Euro)</p>
      <hr>
      <p><strong>Datum:</strong> 20.01.2025</p>
      <div style="display: flex; justify-content: space-between; margin-top: 40px;">
        <div style="border-top: 1px solid #000; padding-top: 4px; width: 200px; text-align: center;">Verkäufer</div>
        <div style="border-top: 1px solid #000; padding-top: 4px; width: 200px; text-align: center;">Käufer</div>
      </div>
    </div>
  `, 'test-kaufvertrag.png', 900)

  // 3. Service-Heft
  await generatePage(`
    <div style="font-family: Arial; padding: 40px; max-width: 600px; background: white;">
      <h1 style="margin-top:0; text-align: center;">Service-Heft</h1>
      <p style="text-align: center;">Volkswagen Golf VIII — WVWZZZ1KZMP012345</p>
      <hr>
      <h3>Hersteller-Wartungsintervalle</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="border-bottom: 1px solid #ccc;">
          <th style="text-align: left; padding: 6px;">Wartung</th>
          <th style="text-align: right; padding: 6px;">km</th>
          <th style="text-align: right; padding: 6px;">Monate</th>
        </tr>
        <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px;">Ölwechsel</td><td style="text-align: right; padding: 6px;">15.000</td><td style="text-align: right; padding: 6px;">12</td></tr>
        <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px;">Inspektion</td><td style="text-align: right; padding: 6px;">30.000</td><td style="text-align: right; padding: 6px;">24</td></tr>
        <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px;">Zahnriemen</td><td style="text-align: right; padding: 6px;">90.000</td><td style="text-align: right; padding: 6px;">60</td></tr>
      </table>
      <hr>
      <h3>Serviceeinträge</h3>

      <div style="border: 1px solid #ccc; padding: 12px; margin-bottom: 12px; border-radius: 4px;">
        <p style="margin:0"><strong>Datum:</strong> 15.03.2022 &nbsp; <strong>km-Stand:</strong> 15.200</p>
        <p style="margin:4px 0 0"><strong>Werkstatt:</strong> Autohaus Berlin GmbH</p>
        <p style="margin:4px 0 0"><strong>Arbeiten:</strong> Ölwechsel mit Filter, Inspektion nach Herstellervorgabe</p>
      </div>

      <div style="border: 1px solid #ccc; padding: 12px; margin-bottom: 12px; border-radius: 4px;">
        <p style="margin:0"><strong>Datum:</strong> 20.09.2023 &nbsp; <strong>km-Stand:</strong> 28.400</p>
        <p style="margin:4px 0 0"><strong>Werkstatt:</strong> Autohaus Berlin GmbH</p>
        <p style="margin:4px 0 0"><strong>Arbeiten:</strong> Ölwechsel, Bremsbeläge vorne erneuert, Luftfilter gewechselt</p>
      </div>

      <div style="border: 1px solid #ccc; padding: 12px; margin-bottom: 12px; border-radius: 4px;">
        <p style="margin:0"><strong>Datum:</strong> 10.06.2024 &nbsp; <strong>km-Stand:</strong> 38.500</p>
        <p style="margin:4px 0 0"><strong>Werkstatt:</strong> Kfz-Meister Müller</p>
        <p style="margin:4px 0 0"><strong>Arbeiten:</strong> Ölwechsel, Inspektion, Klimaanlage Service</p>
      </div>
    </div>
  `, 'test-service-heft.png', 1100)
  // 4. Landscape-Rechnung (Rechnung um 90° CW gedreht — simuliert Handy-Foto im Querformat)
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
  // Screenshot portrait, then rotate 90° CW via canvas to create landscape
  const portraitBuf = await page.screenshot({ fullPage: true })
  await page.setContent(`<canvas id="c"></canvas>
    <script>
      const img = new Image()
      img.onload = () => {
        const c = document.getElementById('c')
        // Swap width/height for 90° CW rotation
        c.width = img.height
        c.height = img.width
        const ctx = c.getContext('2d')
        ctx.translate(c.width / 2, c.height / 2)
        ctx.rotate(Math.PI / 2)
        ctx.drawImage(img, -img.width / 2, -img.height / 2)
        window.__done = true
      }
      img.src = 'data:image/png;base64,${portraitBuf.toString('base64')}'
    </script>`)
  await page.waitForFunction(() => (window as any).__done, { timeout: 10_000 })
  const canvas = page.locator('#c')
  await canvas.screenshot({ path: path.join(dir, 'test-invoice-landscape.png') })
  await browser.close()
  // eslint-disable-next-line no-console
  console.log(`Created: ${path.join(dir, 'test-invoice-landscape.png')}`)
}

main()
