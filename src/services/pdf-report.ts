/**
 * PDF-Dossier eines Fahrzeugs (Verkauf, Übergabe, Treuhänder): Stammdaten, Wartungshistorie,
 * Kosten pro Jahr und Kategorie, Rechnungsliste. jsPDF mit Standardschrift (Helvetica, WinAnsi,
 * reicht für Umlaute und den Schweizer Apostroph), Tabellen über jspdf-autotable.
 */
import type { Invoice } from '../stores/invoices'
import type { Maintenance } from '../stores/maintenances'
import type { VehicleInfo } from './report'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { DEFAULT_CURRENCY, formatCurrency, formatNumber } from '../lib/locale'
import { categoryLabel, costsByYear, maintenanceRows } from './report'

export interface DossierInput {
  vehicle: VehicleInfo
  invoices: Invoice[]
  maintenances: Maintenance[]
  generatedAt?: Date
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[äöü]/g, c => ({ ä: 'ae', ö: 'oe', ü: 'ue' })[c] ?? c).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function dossierFilename(vehicle: VehicleInfo, at: Date = new Date()): string {
  return `wartungsheft-${slug(`${vehicle.make} ${vehicle.model} ${vehicle.licensePlate}`)}-${isoDate(at)}.pdf`
}

export function buildDossier({ vehicle, invoices, maintenances, generatedAt = new Date() }: DossierInput): jsPDF {
  // eslint-disable-next-line new-cap
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 15
  let y = margin

  doc.setFontSize(18)
  doc.text(`${vehicle.make} ${vehicle.model}`, margin, y)
  y += 7
  doc.setFontSize(10)
  doc.setTextColor(90)
  doc.text(`Wartungsheft, Stand ${isoDate(generatedAt)}`, margin, y)
  doc.setTextColor(0)
  y += 8

  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 1.2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
    body: [
      ['Kennzeichen', vehicle.licensePlate],
      ['Baujahr', vehicle.year ? String(vehicle.year) : ''],
      ['Fahrgestellnummer', vehicle.vin ?? ''],
      ['Kilometerstand', vehicle.mileage === undefined ? '' : `${formatNumber(vehicle.mileage)} km`],
    ],
  })
  y = (doc as any).lastAutoTable.finalY + 8

  doc.setFontSize(13)
  doc.text('Wartungshistorie', margin, y)
  y += 3
  const mRows = maintenanceRows(maintenances)
  autoTable(doc, {
    startY: y,
    head: [['Datum', 'Arbeit', 'Kilometerstand']],
    body: mRows.length ? mRows : [['', 'Keine Einträge', '']],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [40, 40, 40] },
  })
  y = (doc as any).lastAutoTable.finalY + 8

  doc.setFontSize(13)
  doc.text('Kosten pro Jahr', margin, y)
  y += 3
  const years = costsByYear(invoices)
  const categories = [...new Set(years.flatMap(r => Object.keys(r.byCategory)))]
  autoTable(doc, {
    startY: y,
    head: [['Jahr', 'Währung', ...categories.map(categoryLabel), 'Total']],
    body: years.length
      ? years.map(r => [String(r.year), r.currency, ...categories.map(c => r.byCategory[c] === undefined ? '' : formatNumber(r.byCategory[c], 2)), formatNumber(r.total, 2)])
      : [['', '', ...categories.map(() => ''), 'Keine Rechnungen']],
    styles: { fontSize: 9, halign: 'right' },
    columnStyles: { 0: { halign: 'left' }, 1: { halign: 'left' } },
    headStyles: { fillColor: [40, 40, 40], halign: 'right' },
  })
  y = (doc as any).lastAutoTable.finalY + 8

  doc.setFontSize(13)
  doc.text('Rechnungen', margin, y)
  y += 3
  const invRows = [...invoices]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(inv => [
      inv.date,
      inv.workshopName ?? '',
      inv.mileageAtService === undefined || inv.mileageAtService === null ? '' : `${formatNumber(inv.mileageAtService)} km`,
      (inv.items ?? []).map(i => categoryLabel(i.category || 'sonstiges')).filter((v, i, a) => a.indexOf(v) === i).join(', '),
      formatCurrency(inv.totalAmount, inv.currency || DEFAULT_CURRENCY),
    ])
  autoTable(doc, {
    startY: y,
    head: [['Datum', 'Werkstatt', 'Kilometerstand', 'Kategorien', 'Betrag']],
    body: invRows.length ? invRows : [['', 'Keine Rechnungen', '', '', '']],
    styles: { fontSize: 9 },
    columnStyles: { 4: { halign: 'right' } },
    headStyles: { fillColor: [40, 40, 40] },
  })

  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(`wartungsheft.ch · Seite ${p} von ${pages}`, margin, doc.internal.pageSize.getHeight() - 8)
    doc.setTextColor(0)
  }
  return doc
}
