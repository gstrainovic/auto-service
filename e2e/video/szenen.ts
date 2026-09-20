/**
 * Gemeinsame Bausteine der Werbeclips (`npm run video`). Keine Tests: die Szenen spielen die App im Handyformat
 * vor, Playwright zeichnet sie auf. Alle Daten sind erfunden, damit nie Kundendaten im Video landen.
 * Die Drehbücher stehen in `video-scripts/privat-video-script.md` und `video-scripts/betrieb-video-script.md`.
 */
import type { Page, TestInfo } from '@playwright/test'
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

/** Ruhig genug, dass ein Zuschauer folgen kann; im Schnitt lässt sich immer noch kürzen */
export const BEAT = 900

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
