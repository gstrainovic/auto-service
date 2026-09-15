/**
 * Beleg im Rechnungsformular: Foto verkleinern und ausrichten oder PDF lesen, dann per KI auswerten.
 * Liefert die erkannten Felder; das Formular füllt damit nur leere Felder (services/invoice-scan.ts).
 */
import type { ScannedFields } from '../services/invoice-scan'
import { ref } from 'vue'
import { userMessage } from '../lib/errors'
import { parseInvoice, parseInvoicePdf } from '../services/ai'
import { getAiAccess } from '../services/ai-access'
import { scannedToFormFields } from '../services/invoice-scan'
import { autoRotateForDocument, getImageMimeType, resizeImage } from './useImageResize'

// Fotos werden ohnehin verkleinert; PDFs gehen unverändert an Mistral OCR (dort max. 50 MB, wie im Chat)
const MAX_IMAGE_SIZE = 25 * 1024 * 1024
const MAX_PDF_SIZE = 50 * 1024 * 1024
/** Ab so vielen Seiten ist ein PDF eher ein Stapel Rechnungen als eine; dann auf den Chat verweisen */
const MULTI_INVOICE_PAGES = 3

export type ScanStatus = 'idle' | 'preparing' | 'scanning' | 'done' | 'error'

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function useInvoiceScan() {
  /** ausgerichtetes Foto (base64 ohne Präfix), wird mit der Rechnung gespeichert; bei PDF leer */
  const imageBase64 = ref<string | null>(null)
  const imagePreview = ref<string | null>(null)
  const pdfName = ref<string | null>(null)
  const status = ref<ScanStatus>('idle')
  const message = ref('')

  async function handleFile(file: File): Promise<ScannedFields | null> {
    message.value = ''
    const isPdf = file.type === 'application/pdf'
    if (!isPdf && !file.type.startsWith('image/')) {
      status.value = 'error'
      message.value = 'Nur Fotos oder PDF möglich.'
      return null
    }
    if (file.size > (isPdf ? MAX_PDF_SIZE : MAX_IMAGE_SIZE)) {
      status.value = 'error'
      message.value = `Datei zu gross (max. ${isPdf ? 50 : 25} MB).`
      return null
    }

    imageBase64.value = null
    imagePreview.value = null
    pdfName.value = null
    try {
      status.value = 'preparing'
      let fields: ScannedFields
      let pages = 1
      if (isPdf) {
        pdfName.value = file.name
        const pdfBase64 = await readAsBase64(file)
        status.value = 'scanning'
        const result = await parseInvoicePdf(pdfBase64, await getAiAccess())
        pages = result.pages
        fields = scannedToFormFields(result.invoice)
      }
      else {
        const { base64 } = await resizeImage(file)
        const rotated = await autoRotateForDocument(base64)
        imageBase64.value = rotated
        imagePreview.value = `data:${getImageMimeType()};base64,${rotated}`
        status.value = 'scanning'
        fields = scannedToFormFields(await parseInvoice(rotated, await getAiAccess()))
      }
      status.value = 'done'
      message.value = Object.keys(fields).length
        ? 'Felder aus dem Beleg ausgefüllt. Bitte prüfen.'
        : 'Auf dem Beleg war nichts Verwertbares zu lesen. Bitte Felder selbst ausfüllen.'
      if (pages >= MULTI_INVOICE_PAGES)
        message.value += ` Das PDF hat ${pages} Seiten. Enthält es mehrere Rechnungen, im Chat hochladen, dort wird jede einzeln erfasst.`
      return fields
    }
    catch (err) {
      status.value = 'error'
      message.value = `${userMessage(err)} Felder bitte selbst ausfüllen.`
      return null
    }
  }

  return { imageBase64, imagePreview, pdfName, status, message, handleFile }
}
