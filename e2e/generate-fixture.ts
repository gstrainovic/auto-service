import * as fs from 'node:fs'
import * as path from 'node:path'
import { chromium } from 'playwright'

const dir = path.join(import.meta.dirname, '..', 'testdateien')

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

async function generatePdf(html: string, filename: string) {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.setContent(html)
  const outputPath = path.join(dir, filename)
  await page.pdf({ path: outputPath, format: 'A4', printBackground: true })
  await browser.close()
  // eslint-disable-next-line no-console
  console.log(`Created: ${outputPath}`)
}

// Schweizer Werkstattrechnung: Positionen netto, MWST 8.1 % separat, Total brutto (Kategorie «Nicht zugeordnet / MwSt.»)
const SWISS_INVOICE = `
  <div style="font-family: Arial; padding: 40px; max-width: 640px; background: white;">
    <h1 style="margin-top:0">Garage Meier AG</h1>
    <p>Industriestrasse 12, 8604 Volketswil · MWST-Nr. CHE-123.456.789 MWST</p>
    <hr>
    <p><strong>Rechnung Nr.:</strong> 25-1182 &nbsp; <strong>Datum:</strong> 03.03.2025</p>
    <p><strong>Kunde:</strong> Anna Muster, Seestrasse 5, 8700 Küsnacht</p>
    <p><strong>Fahrzeug:</strong> Skoda Octavia Combi 2.0 TDI · Kontrollschild ZH 123456</p>
    <p><strong>Fahrgestellnummer:</strong> TMBJJ7NE5L0123456 &nbsp; <strong>Kilometerstand:</strong> 92'300 km</p>
    <hr>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="border-bottom: 1px solid #ccc;">
        <th style="text-align: left; padding: 6px;">Position</th>
        <th style="text-align: right; padding: 6px;">CHF</th>
      </tr>
      <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px;">Service nach Herstellervorgabe</td><td style="text-align: right; padding: 6px;">310.00</td></tr>
      <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px;">Motoröl 5W-30, 4.7 l</td><td style="text-align: right; padding: 6px;">98.70</td></tr>
      <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px;">Ölfilter</td><td style="text-align: right; padding: 6px;">24.80</td></tr>
      <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px;">Bremsflüssigkeit ersetzen</td><td style="text-align: right; padding: 6px;">85.00</td></tr>
      <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px;">Wischerblätter vorne</td><td style="text-align: right; padding: 6px;">42.50</td></tr>
      <tr style="border-top: 1px solid #000;"><td style="padding: 6px;">Total netto</td><td style="text-align: right; padding: 6px;">561.00</td></tr>
      <tr><td style="padding: 6px;">MWST 8.1 %</td><td style="text-align: right; padding: 6px;">45.45</td></tr>
      <tr style="font-weight: bold; border-top: 2px solid #000;"><td style="padding: 6px;">Total CHF</td><td style="text-align: right; padding: 6px;">606.45</td></tr>
    </table>
    <hr>
    <p style="font-size: 12px;">Zahlbar innert 30 Tagen netto.</p>
  </div>
`

// Sammel-PDF: zwei Rechnungen, die zweite über zwei Seiten (Fortsetzung ohne Kopf, Total erst auf Seite 3)
const PAGE_BREAK = '<div style="page-break-after: always;"></div>'
const COLLECTIVE_PDF = `
  <div style="font-family: Arial; padding: 40px; font-size: 14px;">
    <h1 style="margin-top:0">Reifen Keller GmbH</h1>
    <p>Bernstrasse 80, 3072 Ostermundigen</p>
    <hr>
    <p><strong>Rechnung Nr.:</strong> R-4471 &nbsp; <strong>Datum:</strong> 28.10.2024</p>
    <p><strong>Fahrzeug:</strong> VW Golf VIII · BE 98765 &nbsp; <strong>km-Stand:</strong> 41'200</p>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 6px;">Radwechsel Sommer/Winter</td><td style="text-align: right; padding: 6px;">60.00</td></tr>
      <tr><td style="padding: 6px;">Einlagerung Sommerräder</td><td style="text-align: right; padding: 6px;">40.00</td></tr>
      <tr><td style="padding: 6px;">Auswuchten 4 Räder</td><td style="text-align: right; padding: 6px;">48.00</td></tr>
      <tr style="font-weight: bold; border-top: 2px solid #000;"><td style="padding: 6px;">Total CHF inkl. MWST</td><td style="text-align: right; padding: 6px;">148.00</td></tr>
    </table>
  </div>
  ${PAGE_BREAK}
  <div style="font-family: Arial; padding: 40px; font-size: 14px;">
    <h1 style="margin-top:0">Autohaus Berger AG</h1>
    <p>Zürichstrasse 21, 3052 Zollikofen</p>
    <hr>
    <p><strong>Rechnung Nr.:</strong> 88213 &nbsp; <strong>Rechnungsdatum:</strong> 17.04.2025 &nbsp; <strong>Reparaturdatum:</strong> 14.04.2025</p>
    <p><strong>Fahrzeug:</strong> VW Golf VIII · BE 98765 &nbsp; <strong>km-Stand:</strong> 49'850</p>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 6px;">Inspektion 60'000 km</td><td style="text-align: right; padding: 6px;">380.00</td></tr>
      <tr><td style="padding: 6px;">Motoröl 0W-20, 4.3 l</td><td style="text-align: right; padding: 6px;">86.00</td></tr>
      <tr><td style="padding: 6px;">Ölfilter</td><td style="text-align: right; padding: 6px;">21.50</td></tr>
      <tr><td style="padding: 6px;">Luftfilter</td><td style="text-align: right; padding: 6px;">38.90</td></tr>
      <tr><td style="padding: 6px;">Pollenfilter</td><td style="text-align: right; padding: 6px;">34.60</td></tr>
    </table>
    <p style="text-align: right; font-size: 12px;">Seite 1/2 – Fortsetzung nächste Seite</p>
  </div>
  ${PAGE_BREAK}
  <div style="font-family: Arial; padding: 40px; font-size: 14px;">
    <p style="font-size: 12px;">Rechnung 88213 · Seite 2/2</p>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 6px;">Bremsscheiben und Beläge vorne</td><td style="text-align: right; padding: 6px;">520.00</td></tr>
      <tr><td style="padding: 6px;">Arbeit Bremsen 1.5 Std.</td><td style="text-align: right; padding: 6px;">210.00</td></tr>
      <tr style="border-top: 1px solid #000;"><td style="padding: 6px;">Total netto</td><td style="text-align: right; padding: 6px;">1291.00</td></tr>
      <tr><td style="padding: 6px;">MWST 8.1 %</td><td style="text-align: right; padding: 6px;">104.55</td></tr>
      <tr style="font-weight: bold; border-top: 2px solid #000;"><td style="padding: 6px;">Total CHF</td><td style="text-align: right; padding: 6px;">1395.55</td></tr>
    </table>
  </div>
`

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

  // 5. Schweizer Rechnung als Foto (PNG) und als PDF aus dem Mail-Postfach
  await generatePage(SWISS_INVOICE, 'test-rechnung-ch.png', 1000)
  await generatePdf(SWISS_INVOICE, 'test-rechnung-ch.pdf')

  // 6. Sammel-PDF mit zwei Rechnungen auf drei Seiten
  await generatePdf(COLLECTIVE_PDF, 'test-rechnungen-sammel.pdf')
}

main()
