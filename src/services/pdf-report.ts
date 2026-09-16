/**
 * PDF-Berichte: Dossier eines Fahrzeugs (Verkauf, Übergabe) und Fuhrpark-Übersicht (Treuhänder, Jahresabschluss).
 * jsPDF mit Standardschrift (Helvetica, WinAnsi, reicht für Umlaute und den Schweizer Apostroph), Tabellen über
 * jspdf-autotable. Fremde Währungen werden mit `currency` (Heimwährung, Kurse) umgerechnet, siehe report.ts.
 */
import type { Invoice } from '../stores/invoices'
import type { Maintenance } from '../stores/maintenances'
import type { CurrencyOptions, VehicleInfo } from './report'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCurrency, formatDate, formatNumber, normalizeCurrency } from '../lib/locale'
import { categoryLabel, costsByYear, fleetCostsByVehicleYear, formatKm, maintenanceRows } from './report'
import { serviceRecordSummary } from './service-record'
import { soldLabel } from './vehicle-status'

export interface DossierInput {
  vehicle: VehicleInfo
  invoices: Invoice[]
  maintenances: Maintenance[]
  generatedAt?: Date
  /** Heimwährung und Kurse: fremde Währungen werden in der Kostentabelle umgerechnet */
  currency?: CurrencyOptions
}

export interface FleetReportInput {
  vehicles: (VehicleInfo & { id: string })[]
  invoices: Invoice[]
  maintenances: Maintenance[]
  generatedAt?: Date
  currency?: CurrencyOptions
}

const MARGIN = 15
const HEAD = { fillColor: [40, 40, 40] as [number, number, number] }

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[äöü]/g, c => ({ ä: 'ae', ö: 'oe', ü: 'ue' })[c] ?? c).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function dossierFilename(vehicle: VehicleInfo, at: Date = new Date()): string {
  return `wartungsheft-${slug(`${vehicle.make} ${vehicle.model} ${vehicle.licensePlate}`)}-${isoDate(at)}.pdf`
}

export function fleetReportFilename(at: Date = new Date()): string {
  return `wartungsheft-alle-fahrzeuge-${isoDate(at)}.pdf`
}

function newDoc(): jsPDF {
  // eslint-disable-next-line new-cap
  return new jsPDF({ unit: 'mm', format: 'a4' })
}

function finalY(doc: jsPDF): number {
  return (doc as any).lastAutoTable.finalY
}

function heading(doc: jsPDF, y: number, text: string): number {
  doc.setFontSize(13)
  doc.text(text, MARGIN, y)
  return y + 3
}

function title(doc: jsPDF, y: number, text: string, subtitle: string): number {
  doc.setFontSize(18)
  doc.text(text, MARGIN, y)
  y += 7
  doc.setFontSize(10)
  doc.setTextColor(90)
  doc.text(subtitle, MARGIN, y)
  doc.setTextColor(0)
  return y + 8
}

/** Stammdaten, Wartungshistorie, Kosten pro Jahr und Rechnungsliste eines Fahrzeugs ab Position y. */
function renderVehicle(doc: jsPDF, y: number, { vehicle, invoices, maintenances, currency }: DossierInput): number {
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 1.2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
    body: [
      ['Kennzeichen', vehicle.licensePlate],
      ['Baujahr', vehicle.year ? String(vehicle.year) : ''],
      ['Fahrgestellnummer', vehicle.vin ?? ''],
      ['Kilometerstand', formatKm(vehicle.mileage)],
      ...(vehicle.soldAt ? [['Verkauft', soldLabel(vehicle).replace(/^Verkauft am /, '')]] : []),
    ],
  })
  y = finalY(doc) + 8

  y = heading(doc, y, 'Wartungshistorie')
  const mRows = maintenanceRows(maintenances)
  autoTable(doc, {
    startY: y,
    head: [['Datum', 'Arbeit', 'Kilometerstand']],
    body: mRows.length ? mRows : [['', 'Keine Einträge', '']],
    styles: { fontSize: 9 },
    headStyles: HEAD,
  })
  y = finalY(doc) + 8

  y = heading(doc, y, 'Kosten pro Jahr')
  const years = costsByYear(invoices, currency)
  const categories = [...new Set(years.flatMap(r => Object.keys(r.byCategory)))]
  const convertedCount = years.reduce((n, r) => n + r.converted, 0)
  autoTable(doc, {
    startY: y,
    head: [['Jahr', 'Währung', ...categories.map(categoryLabel), 'Total']],
    body: years.length
      ? years.map(r => [String(r.year), r.currency, ...categories.map(c => r.byCategory[c] === undefined ? '' : formatNumber(r.byCategory[c], 2)), formatNumber(r.total, 2)])
      : [['', '', ...categories.map(() => ''), 'Keine Rechnungen']],
    styles: { fontSize: 9, halign: 'right' },
    columnStyles: { 0: { halign: 'left' }, 1: { halign: 'left' } },
    headStyles: { ...HEAD, halign: 'right' },
  })
  y = finalY(doc) + 4
  if (convertedCount > 0 && currency) {
    doc.setFontSize(8)
    doc.setTextColor(90)
    doc.text(`${convertedCount} Rechnung(en) in fremder Währung zum EZB-Kurs am Rechnungsdatum in ${currency.homeCurrency} umgerechnet.`, MARGIN, y)
    doc.setTextColor(0)
  }
  y += 6

  y = heading(doc, y, 'Rechnungen')
  const invRows = [...invoices]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(inv => [
      formatDate(inv.date),
      inv.workshopName ?? '',
      formatKm(inv.mileageAtService),
      (inv.items ?? []).map(i => categoryLabel(i.category || 'sonstiges')).filter((v, i, a) => a.indexOf(v) === i).join(', '),
      formatCurrency(inv.totalAmount, normalizeCurrency(inv.currency)),
    ])
  autoTable(doc, {
    startY: y,
    head: [['Datum', 'Werkstatt', 'Kilometerstand', 'Kategorien', 'Betrag']],
    body: invRows.length ? invRows : [['', 'Keine Rechnungen', '', '', '']],
    styles: { fontSize: 9 },
    columnStyles: { 4: { halign: 'right' } },
    headStyles: HEAD,
  })
  return finalY(doc)
}

function footer(doc: jsPDF): void {
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(`wartungsheft.ch · Seite ${p} von ${pages}`, MARGIN, doc.internal.pageSize.getHeight() - 8)
    doc.setTextColor(0)
  }
}

export interface ServiceRecordInput extends DossierInput {
  /** Preise und Rechnungsbeträge zeigen; beim Verkauf meist unerwünscht */
  withPrices?: boolean
}

export function serviceRecordFilename(vehicle: VehicleInfo, at: Date = new Date()): string {
  return `serviceheft-${slug(`${vehicle.make} ${vehicle.model} ${vehicle.licensePlate}`)}-${isoDate(at)}.pdf`
}

/**
 * Übergabemappe für den Käufer: Auszug auf der ersten Seite, danach die Wartungshistorie, die Belege als Bilder
 * und am Schluss eine Seite über Wartungsheft. Ohne `withPrices` steht nirgends ein Betrag.
 */
export function buildServiceRecord(input: ServiceRecordInput): jsPDF {
  const { vehicle, invoices, maintenances, generatedAt = new Date(), withPrices = false, currency } = input
  const doc = newDoc()
  const summary = serviceRecordSummary(maintenances, generatedAt)
  let y = title(doc, MARGIN, `Serviceheft ${vehicle.make} ${vehicle.model}`, `Stand ${formatDate(generatedAt)}`)

  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 1.2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } },
    body: [
      ['Kennzeichen', vehicle.licensePlate],
      ['Baujahr', vehicle.year ? String(vehicle.year) : ''],
      ['Fahrgestellnummer', vehicle.vin ?? ''],
      ['Kilometerstand', formatKm(vehicle.mileage)],
      ['Einträge', summary.count ? `${summary.count} von ${formatDate(summary.from)} bis ${formatDate(summary.to)}` : 'keine'],
      ['Belegte Laufleistung', summary.firstMileage && summary.lastMileage ? `${formatKm(summary.firstMileage)} bis ${formatKm(summary.lastMileage)}` : ''],
      ['Historie', summary.gapless ? 'lückenlos dokumentiert' : `mit Lücken (${summary.note})`],
      ['Belege', `${invoices.filter(i => i.imageData).length} von ${invoices.length} Rechnungen mit Foto`],
    ],
  })
  y = finalY(doc) + 8

  y = heading(doc, y, 'Wartungshistorie')
  const rows = maintenanceRows(maintenances)
  autoTable(doc, {
    startY: y,
    head: [['Datum', 'Arbeit', 'Kilometerstand']],
    body: rows.length ? rows : [['—', 'Keine Einträge', '']],
    styles: { fontSize: 9 },
    headStyles: HEAD,
  })
  y = finalY(doc) + 8

  if (withPrices) {
    y = heading(doc, y, 'Kosten pro Jahr')
    const years = costsByYear(invoices, currency)
    autoTable(doc, {
      startY: y,
      head: [['Jahr', 'Total']],
      body: years.length ? years.map(r => [String(r.year), formatCurrency(r.total, r.currency)]) : [['—', '']],
      styles: { fontSize: 9 },
      headStyles: HEAD,
    })
  }

  // Belege als Bildseiten, damit der Käufer die Rechnungen sieht und nicht nur die Liste
  for (const invoice of [...invoices].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!invoice.imageData)
      continue
    doc.addPage()
    doc.setFontSize(11)
    const head = [formatDate(invoice.date), invoice.workshopName, withPrices ? formatCurrency(invoice.totalAmount, normalizeCurrency(invoice.currency)) : '']
      .filter(Boolean)
      .join(' · ')
    doc.text(head, MARGIN, MARGIN)
    try {
      const format = invoice.imageData.startsWith('/9j/') ? 'JPEG' : 'WEBP'
      const width = doc.internal.pageSize.getWidth() - 2 * MARGIN
      doc.addImage(invoice.imageData, format, MARGIN, MARGIN + 6, width, 0)
    }
    catch {
      doc.setFontSize(9)
      doc.text('Beleg konnte nicht eingebettet werden.', MARGIN, MARGIN + 12)
    }
  }

  // Schlussseite: wer das Heft geführt hat
  doc.addPage()
  let z = title(doc, MARGIN, 'Geführt mit Wartungsheft', 'wartungsheft.ch')
  doc.setFontSize(10)
  for (const line of [
    'Werkstattrechnung fotografieren, die KI liest Werkstatt, Datum, Betrag und Positionen heraus.',
    'Fälligkeiten für Service, Bremsen, Reifen und MFK, mit E-Mail-Erinnerung.',
    'Kosten pro Fahrzeug und Jahr, Export für den Treuhänder.',
    'Dieses Serviceheft als PDF, jederzeit neu erstellt.',
    'Daten auf Servern in der Schweiz, KI-Verarbeitung in der EU.',
  ]) {
    doc.text(`•  ${line}`, MARGIN, z)
    z += 6
  }

  footer(doc)
  return doc
}

export function buildDossier(input: DossierInput): jsPDF {
  const { vehicle, generatedAt = new Date() } = input
  const doc = newDoc()
  const y = title(doc, MARGIN, `${vehicle.make} ${vehicle.model}`, `Wartungsheft, Stand ${formatDate(generatedAt)}`)
  renderVehicle(doc, y, input)
  footer(doc)
  return doc
}

/** Übersichtsseite mit Kosten pro Fahrzeug und Jahr, danach eine Seite je Fahrzeug wie im Dossier. */
export function buildFleetReport({ vehicles, invoices, maintenances, generatedAt = new Date(), currency }: FleetReportInput): jsPDF {
  const doc = newDoc()
  let y = title(doc, MARGIN, 'Fuhrpark-Übersicht', `Wartungsheft, ${vehicles.length} Fahrzeuge, Stand ${formatDate(generatedAt)}`)

  y = heading(doc, y, 'Kosten pro Fahrzeug und Jahr')
  const rows = fleetCostsByVehicleYear(vehicles, invoices, currency)
  const totals = new Map<string, number>()
  for (const r of rows)
    totals.set(r.currency, Math.round(((totals.get(r.currency) ?? 0) + r.total) * 100) / 100)
  autoTable(doc, {
    startY: y,
    head: [['Jahr', 'Fahrzeug', 'Total']],
    body: rows.length
      ? [
          ...rows.map(r => [String(r.year), r.vehicle, formatCurrency(r.total, r.currency)]),
          ['', 'Gesamt', [...totals].map(([c, t]) => formatCurrency(t, c)).join(' + ')],
        ]
      : [['', 'Keine Rechnungen', '']],
    styles: { fontSize: 9 },
    columnStyles: { 2: { halign: 'right' } },
    headStyles: HEAD,
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === rows.length && rows.length)
        data.cell.styles.fontStyle = 'bold'
    },
  })
  if (currency) {
    const converted = invoices.filter(i => normalizeCurrency(i.currency) !== currency.homeCurrency).length
    if (converted > 0) {
      y = finalY(doc) + 4
      doc.setFontSize(8)
      doc.setTextColor(90)
      doc.text(`Rechnungen in fremder Währung zum EZB-Kurs am Rechnungsdatum in ${currency.homeCurrency} umgerechnet; ohne Kurs in eigener Währung ausgewiesen.`, MARGIN, y)
      doc.setTextColor(0)
    }
  }

  for (const v of vehicles) {
    doc.addPage()
    const yv = title(doc, MARGIN, `${v.make} ${v.model}`, v.licensePlate)
    renderVehicle(doc, yv, {
      vehicle: v,
      invoices: invoices.filter(i => i.vehicleId === v.id),
      maintenances: maintenances.filter(m => m.vehicleId === v.id),
      currency,
    })
  }
  footer(doc)
  return doc
}
