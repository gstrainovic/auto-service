/**
 * Belege im Rechnungsformular: Fotos verkleinern und ausrichten, PDFs lesen, dann per KI auswerten.
 * Eine Rechnung → Felder vorbefüllen (services/invoice-scan.ts fillEmptyFields).
 * Mehrere Rechnungen (Sammel-PDF oder mehrere Fotos) → Stapel mit Duplikat-Markierung zum Bestätigen.
 */
import type { ParsedInvoice } from '../services/ai'
import type { BatchEntry, BatchVehicle, ScannedFields } from '../services/invoice-scan'
import { ref } from 'vue'
import { userMessage } from '../lib/errors'
import { parseInvoice, parseInvoicesPdf } from '../services/ai'
import { getAiAccess } from '../services/ai-access'
import { buildBatch, pagesLabel, plateAssignment, scannedToFormFields } from '../services/invoice-scan'
import { autoRotateForDocument, getImageMimeType, readFileAsBase64 as readAsBase64, resizeImage } from './useImageResize'

// Fotos werden ohnehin verkleinert; PDFs gehen unverändert an Mistral OCR (dort max. 50 MB, wie im Chat)
const MAX_IMAGE_SIZE = 25 * 1024 * 1024
const MAX_PDF_SIZE = 50 * 1024 * 1024

export type ScanStatus = 'idle' | 'scanning' | 'done' | 'error'
export type ScanOutcome
  = | { kind: 'single', fields: ScannedFields, scanPending?: boolean }
    | { kind: 'batch', entries: BatchEntry[] }

interface Scanned { parsed: ParsedInvoice, source: string, imageBase64?: string }

/** Monatslimit und fehlende Verbindung brechen den ganzen Stapel ab; andere Fehler betreffen nur einen Beleg */
function isFatal(err: unknown): boolean {
  const msg = userMessage(err)
  return msg.startsWith('Monatslimit') || msg.startsWith('Keine Verbindung') || msg.startsWith('Bitte neu anmelden')
}

export function useInvoiceScan() {
  /** ausgerichtetes Foto (base64 ohne Präfix) bei einer einzelnen Rechnung aus einem Foto */
  const imageBase64 = ref<string | null>(null)
  const imagePreview = ref<string | null>(null)
  const pdfName = ref<string | null>(null)
  const status = ref<ScanStatus>('idle')
  const progress = ref('')
  const message = ref('')

  function fail(text: string): null {
    status.value = 'error'
    message.value = text
    return null
  }

  async function prepareImage(file: File): Promise<string> {
    const { base64 } = await resizeImage(file)
    return autoRotateForDocument(base64)
  }

  async function handleFiles(
    files: File[],
    existing: { vehicleId?: string, date: string, totalAmount?: number }[],
    context: { vehicles?: BatchVehicle[], currentVehicleId?: string } = {},
  ): Promise<ScanOutcome | null> {
    // Einzelne Rechnung: nennt der Beleg ein anderes oder unbekanntes Kontrollschild, im Hinweis sagen
    const plateHint = (parsed: ParsedInvoice) => {
      const { note, vehicleId } = plateAssignment(parsed.licensePlate, context.vehicles ?? [], context.currentVehicleId)
      if (!note)
        return ''
      return vehicleId === context.currentVehicleId ? ` Achtung: ${note}.` : ` Achtung: Beleg nennt ${note.replace(/^Kontrollschild /, 'Kontrollschild ')}, nicht dieses Fahrzeug.`
    }
    message.value = ''
    imageBase64.value = null
    imagePreview.value = null
    pdfName.value = null
    if (!files.length)
      return null
    for (const f of files) {
      const isPdf = f.type === 'application/pdf'
      if (!isPdf && !f.type.startsWith('image/'))
        return fail(`${f.name}: nur Fotos oder PDF möglich.`)
      if (f.size > (isPdf ? MAX_PDF_SIZE : MAX_IMAGE_SIZE))
        return fail(`${f.name}: Datei zu gross (max. ${isPdf ? 50 : 25} MB).`)
    }

    // Ohne Verbindung gibt es keinen Scan: Foto trotzdem übernehmen, der Scan wird später nachgeholt.
    // Auch das Ausrichten entfällt, Tesseract lädt seine Worker-Dateien vom CDN.
    if (!navigator.onLine && files.length === 1 && files[0]!.type !== 'application/pdf') {
      const { base64 } = await resizeImage(files[0]!)
      imageBase64.value = base64
      imagePreview.value = `data:${getImageMimeType()};base64,${base64}`
      status.value = 'done'
      message.value = 'Offline: Der Beleg wird gespeichert, der Scan läuft nach, sobald du wieder online bist.'
      return { kind: 'single', fields: {}, scanPending: true }
    }

    status.value = 'scanning'
    try {
      const access = await getAiAccess()

      // Ein einzelnes Foto: wie bisher Vorschau und Vorbefüllung
      if (files.length === 1 && files[0]!.type !== 'application/pdf') {
        progress.value = 'Beleg wird ausgerichtet und gelesen …'
        const rotated = await prepareImage(files[0]!)
        imageBase64.value = rotated
        imagePreview.value = `data:${getImageMimeType()};base64,${rotated}`
        const parsed = await parseInvoice(rotated, access)
        return single(scannedToFormFields(parsed), plateHint(parsed))
      }

      const scanned: Scanned[] = []
      const failed: string[] = []
      for (const [i, file] of files.entries()) {
        const counter = files.length > 1 ? ` (${i + 1} von ${files.length})` : ''
        try {
          if (file.type === 'application/pdf') {
            progress.value = `PDF wird gelesen${counter} …`
            const { invoices } = await parseInvoicesPdf(await readAsBase64(file), access, undefined, (done, total) => {
              progress.value = `PDF: Seite ${done} von ${total} ausgewertet${counter} …`
            })
            const prefix = files.length > 1 ? `${file.name}, ` : ''
            for (const inv of invoices)
              scanned.push({ parsed: inv, source: `${prefix}${pagesLabel(inv.pages)}` })
            if (files.length === 1)
              pdfName.value = file.name
          }
          else {
            progress.value = `Foto wird gelesen${counter} …`
            const rotated = await prepareImage(file)
            scanned.push({ parsed: await parseInvoice(rotated, access), source: file.name, imageBase64: rotated })
          }
        }
        catch (err) {
          if (isFatal(err))
            throw err
          console.error('[scan]', file.name, err)
          failed.push(file.name)
        }
      }

      const failedNote = failed.length ? ` Nicht lesbar: ${failed.join(', ')}.` : ''
      // Sammel-PDF mit genau einer Rechnung: Formular vorbefüllen
      if (scanned.length === 1 && files.length === 1)
        return single(scannedToFormFields(scanned[0]!.parsed), `${plateHint(scanned[0]!.parsed)}${failedNote}`)
      if (!scanned.length)
        return fail(`Auf den Belegen war keine Rechnung zu lesen. Bitte Felder selbst ausfüllen.${failedNote}`)

      const entries = buildBatch(scanned, existing, context)
      status.value = 'done'
      const dupes = entries.filter(e => e.duplicate).length
      const others = entries.filter(e => e.plateNote).length
      message.value = `${entries.length} Rechnungen erkannt${dupes ? `, davon ${dupes} schon erfasst oder doppelt` : ''}${others ? `, ${others} mit anderem Kontrollschild` : ''}. Bitte prüfen.${failedNote}`
      return { kind: 'batch', entries }
    }
    catch (err) {
      return fail(`${userMessage(err)} Felder bitte selbst ausfüllen.`)
    }
    finally {
      progress.value = ''
    }
  }

  function single(fields: ScannedFields, note = ''): ScanOutcome {
    status.value = 'done'
    message.value = (Object.keys(fields).length
      ? 'Felder aus dem Beleg ausgefüllt. Bitte prüfen.'
      : 'Auf dem Beleg war nichts Verwertbares zu lesen. Bitte Felder selbst ausfüllen.') + note
    return { kind: 'single', fields }
  }

  return { imageBase64, imagePreview, pdfName, status, progress, message, handleFiles }
}
