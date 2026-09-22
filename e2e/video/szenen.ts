/**
 * Gemeinsame Bausteine der Werbeclips (`npm run video`). Keine Tests: die Szenen spielen die App im Handyformat
 * vor, Playwright zeichnet sie auf. Alle Daten sind erfunden, damit nie Kundendaten im Video landen.
 * Die Drehbücher stehen in `video-scripts/privat-video-script.md` und `video-scripts/betrieb-video-script.md`.
 */
import type { Browser, Page, TestInfo } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import process from 'node:process'
import { waitForInstantDB } from '../fixtures/test-fixtures'

/** Zielordner der fertigen Clips; `scripts/video-clips.sh` wandelt sie von dort aus um */
export const CLIP_DIR = `${process.cwd()}/video-out`

/**
 * Speichert die Aufnahme unter dem Namen der Szene statt unter Playwrights Ordner-Hash. Gehört in ein
 * `test.afterEach`, dort wartet `saveAs` auf das Ende der Aufnahme.
 */
export async function clipSpeichern(page: Page, testInfo: TestInfo): Promise<void> {
  const video = page.video()
  if (!video)
    return
  const slug = testInfo.title
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  // Der Desktop-Lauf legt eigene Dateien an, sonst überschreiben sich die beiden Formate
  const suffix = testInfo.project.name === 'video-desktop' ? '-desktop' : ''
  await mkdir(CLIP_DIR, { recursive: true })
  // Erst die Seite schliessen: solange sie offen ist, wartet saveAs auf das Ende der Aufnahme und läuft in den Timeout
  await page.close()
  await video.saveAs(`${CLIP_DIR}/${slug}${suffix}.webm`)
}

/**
 * Ruhig genug, dass ein Zuschauer folgen kann; im Schnitt lässt sich immer noch kürzen. Zuschauer meldeten,
 * das Tempo sei zu hoch — deshalb lieber zu langsam aufnehmen als zu schnell.
 */
export const BEAT = 1200

export async function beat(page: Page, factor = 1): Promise<void> {
  await page.waitForTimeout(BEAT * factor)
}

/** Zeigt den Mauszeiger als Punkt, sonst wirkt die Aufnahme wie ein Standbild mit Sprüngen */
export async function showPointer(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      .video-pointer {
        position: fixed; z-index: 2147483647; width: 28px; height: 28px; margin: -14px 0 0 -14px;
        border-radius: 50%; background: rgba(20, 120, 255, 0.35); border: 2px solid rgba(20, 120, 255, 0.9);
        pointer-events: none; transition: transform 120ms ease-out; }
    `,
  })
  await page.evaluate(() => {
    const dot = document.createElement('div')
    dot.className = 'video-pointer'
    document.body.append(dot)
    document.addEventListener('mousemove', (e) => {
      dot.style.left = `${e.clientX}px`
      dot.style.top = `${e.clientY}px`
    })
  })
}

/** Klick mit sichtbarer Mausbewegung: erst hinfahren, kurz warten, dann klicken */
export async function slowClick(page: Page, selector: string | { click: () => Promise<void>, hover: () => Promise<void> }, pause = 0.6): Promise<void> {
  const target = typeof selector === 'string' ? page.locator(selector) : selector
  await target.hover()
  await beat(page, pause)
  await target.click()
  await beat(page, pause)
}

export interface VideoVehicle {
  make: string
  model: string
  year: number
  mileage: number
  licensePlate: string
  soldAt?: string
}

export interface VideoInvoice {
  vehicleIndex: number
  workshopName: string
  date: string
  totalAmount: number
  mileageAtService: number
  items: { description: string, category: string, amount: number }[]
}

export interface VideoMaintenance {
  vehicleIndex: number
  type: string
  description: string
  doneAt: string
  mileageAtService: number
}

/** Erfundener Bestand, damit die App im Video nicht leer aussieht */
export async function seed(page: Page, data: {
  vehicles: VideoVehicle[]
  invoices?: VideoInvoice[]
  maintenances?: VideoMaintenance[]
}): Promise<void> {
  await page.goto('/')
  await waitForInstantDB(page)
  await page.evaluate(async (payload) => {
    const { db, tx, id: genId } = (window as any).__instantdb
    const now = new Date().toISOString()
    const vehicleIds = payload.vehicles.map(() => genId())
    const steps: any[] = payload.vehicles.map((v: any, i: number) =>
      tx.vehicles[vehicleIds[i]].update({ ...v, createdAt: now, updatedAt: now, source: 'formular' }),
    )
    for (const inv of payload.invoices ?? []) {
      steps.push(tx.invoices[genId()].update({
        vehicleId: vehicleIds[inv.vehicleIndex],
        workshopName: inv.workshopName,
        date: inv.date,
        totalAmount: inv.totalAmount,
        currency: 'CHF',
        mileageAtService: inv.mileageAtService,
        items: inv.items,
        createdAt: now,
        updatedAt: now,
        source: 'formular',
      }))
    }
    for (const m of payload.maintenances ?? []) {
      steps.push(tx.maintenances[genId()].update({
        vehicleId: vehicleIds[m.vehicleIndex],
        type: m.type,
        description: m.description,
        doneAt: m.doneAt,
        mileageAtService: m.mileageAtService,
        status: 'done',
        createdAt: now,
        updatedAt: now,
        source: 'formular',
      }))
    }
    await db.transact(steps)
  }, data)
}

/** Tage vor heute als ISO-Tag: die Fälligkeiten im Video sollen immer gleich aussehen, egal wann gedreht wird */
export function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
}

export interface MusterRechnung {
  werkstatt: string
  adresse: string
  datum: string
  fahrzeug: string
  kontrollschild: string
  kilometer: number
  positionen: { text: string, betrag: number }[]
}

function chf(betrag: number): string {
  return betrag.toFixed(2).replace(/\B(?=(\d{3})+\.)/g, '\'')
}

/**
 * Rendert eine Werkstattrechnung mit genau den Angaben, die der gemockte Scan in die Felder füllt: Bild und
 * Ergebnis müssen im Film übereinstimmen. Werkstatt und Adresse sind erfundene Musternamen, keine echte Firma.
 * Eigener Browser-Kontext ohne Aufnahme, das Bild landet im Ausgabeordner des Clips.
 */
export async function musterRechnungFoto(browser: Browser, testInfo: TestInfo, r: MusterRechnung): Promise<string> {
  const [y, m, d] = r.datum.split('-')
  const total = r.positionen.reduce((sum, p) => sum + p.betrag, 0)
  const zeilen = r.positionen.map(p => `<tr><td>${p.text}</td><td class="r">${chf(p.betrag)}</td></tr>`).join('')
  // Hochformat wie ein A4-Blatt: ein breiteres Bild dreht die App als Handyfoto um 90° (autoRotateForDocument)
  const html = `<div style="font-family: Arial; padding: 40px; width: 640px; min-height: 905px; background: white; color: #111;">
    <div style="float:right; border:2px solid #999; color:#999; padding:2px 8px; font-size:13px;">MUSTER</div>
    <h1 style="margin:0 0 6px">${r.werkstatt}</h1>
    <p style="margin:0">${r.adresse}</p>
    <hr>
    <p><strong>Rechnung Nr.:</strong> 26-0417 &nbsp; <strong>Datum:</strong> ${d}.${m}.${y}</p>
    <p><strong>Fahrzeug:</strong> ${r.fahrzeug} · Kontrollschild ${r.kontrollschild}</p>
    <p><strong>Kilometerstand:</strong> ${r.kilometer.toLocaleString('de-CH').replace(/’/g, '\'')} km</p>
    <hr>
    <style>td,th{padding:6px;border-bottom:1px solid #eee} .r{text-align:right}</style>
    <table style="width:100%; border-collapse:collapse">
      <tr><th style="text-align:left">Position</th><th class="r">CHF</th></tr>
      ${zeilen}
      <tr style="font-weight:bold; border-top:2px solid #000"><td>Total CHF inkl. MWST</td><td class="r">${chf(total)}</td></tr>
    </table>
  </div>`
  const page = await browser.newPage({ viewport: { width: 720, height: 900 } })
  await page.setContent(html)
  const pfad = testInfo.outputPath('muster-rechnung.png')
  await page.locator('div').first().screenshot({ path: pfad })
  await page.close()
  return pfad
}
