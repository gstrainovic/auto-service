/**
 * Fahrzeugausweis oder Kaufvertrag im Formular «Neues Fahrzeug»: Foto ausrichten (quer erlaubt) oder PDF lesen,
 * per KI auswerten, bereinigte Felder zurückgeben (services/vehicle-scan.ts). Das Formular füllt nur leere Felder.
 */
import type { VehicleFields } from '../services/vehicle-scan'
import { ref } from 'vue'
import { userMessage } from '../lib/errors'
import { parseVehicleDocument, parseVehicleDocumentPdf } from '../services/ai'
import { getAiAccess } from '../services/ai-access'
import { vehicleDocToFields } from '../services/vehicle-scan'
import { autoRotateForDocument, getImageMimeType, readFileAsBase64 as readAsBase64, resizeImage } from './useImageResize'

const MAX_IMAGE_SIZE = 25 * 1024 * 1024
const MAX_PDF_SIZE = 50 * 1024 * 1024

export function useVehicleScan() {
  const preview = ref<string | null>(null)
  const scanning = ref(false)
  const failed = ref(false)
  const message = ref('')

  async function handleFile(file: File): Promise<Partial<VehicleFields> | null> {
    message.value = ''
    failed.value = false
    preview.value = null
    const isPdf = file.type === 'application/pdf'
    if (!isPdf && !file.type.startsWith('image/')) {
      failed.value = true
      message.value = 'Nur Fotos oder PDF möglich.'
      return null
    }
    if (file.size > (isPdf ? MAX_PDF_SIZE : MAX_IMAGE_SIZE)) {
      failed.value = true
      message.value = `Datei zu gross (max. ${isPdf ? 50 : 25} MB).`
      return null
    }

    scanning.value = true
    try {
      const access = await getAiAccess()
      let doc
      if (isPdf) {
        doc = await parseVehicleDocumentPdf(await readAsBase64(file), access)
      }
      else {
        const { base64 } = await resizeImage(file)
        // Der Ausweis liegt aufgeklappt quer: nicht wie eine Rechnung pauschal hochkant drehen
        const rotated = await autoRotateForDocument(base64, { expectPortrait: false })
        preview.value = `data:${getImageMimeType()};base64,${rotated}`
        doc = await parseVehicleDocument(rotated, access)
      }
      const fields = vehicleDocToFields(doc)
      message.value = Object.keys(fields).length
        ? 'Felder aus dem Dokument ausgefüllt. Bitte prüfen.'
        : 'Im Dokument waren keine Fahrzeugdaten zu lesen. Bitte Felder selbst ausfüllen.'
      return fields
    }
    catch (err) {
      failed.value = true
      message.value = `${userMessage(err)} Felder bitte selbst ausfüllen.`
      return null
    }
    finally {
      scanning.value = false
    }
  }

  return { preview, scanning, failed, message, handleFile }
}
