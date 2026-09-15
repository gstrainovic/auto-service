/**
 * Serviceheft-Seiten ohne Chat: Fotos ausrichten oder PDF lesen, pro Datei per KI auswerten und
 * Stempel-Einträge sowie Hersteller-Intervalle über alle Dateien sammeln.
 */
import type { ScannedInterval, ServiceBookPage } from '../services/service-book'
import { ref } from 'vue'
import { userMessage } from '../lib/errors'
import { parseServiceBook, parseServiceBookPdf } from '../services/ai'
import { getAiAccess } from '../services/ai-access'
import { autoRotateForDocument, readFileAsBase64, resizeImage } from './useImageResize'

const MAX_IMAGE_SIZE = 25 * 1024 * 1024
const MAX_PDF_SIZE = 50 * 1024 * 1024

export interface ServiceBookScan {
  pages: ServiceBookPage[]
  intervals: ScannedInterval[]
}

export function useServiceBookScan() {
  const scanning = ref(false)
  const failed = ref(false)
  const progress = ref('')

  async function handleFiles(files: File[]): Promise<ServiceBookScan> {
    failed.value = false
    const result: ServiceBookScan = { pages: [], intervals: [] }
    const errors: string[] = []
    scanning.value = true
    try {
      const access = await getAiAccess()
      for (const [i, file] of files.entries()) {
        progress.value = files.length > 1 ? `Seite ${i + 1} von ${files.length} wird gelesen …` : 'Serviceheft wird gelesen …'
        const isPdf = file.type === 'application/pdf'
        if (!isPdf && !file.type.startsWith('image/')) {
          errors.push(`${file.name}: nur Fotos oder PDF möglich.`)
          continue
        }
        if (file.size > (isPdf ? MAX_PDF_SIZE : MAX_IMAGE_SIZE)) {
          errors.push(`${file.name}: zu gross (max. ${isPdf ? 50 : 25} MB).`)
          continue
        }
        try {
          const parsed = isPdf
            ? await parseServiceBookPdf(await readFileAsBase64(file), access)
            : await parseServiceBook(await autoRotateForDocument((await resizeImage(file)).base64), access)
          result.pages.push(...(parsed.entries ?? []))
          result.intervals.push(...(parsed.manufacturerIntervals ?? []))
        }
        catch (err) {
          const msg = userMessage(err)
          // Monatslimit und fehlende Verbindung betreffen alle weiteren Seiten
          if (msg.startsWith('Monatslimit') || msg.startsWith('Keine Verbindung') || msg.startsWith('Bitte neu anmelden')) {
            errors.push(msg)
            break
          }
          errors.push(`${file.name}: ${msg}`)
        }
      }
    }
    catch (err) {
      errors.push(userMessage(err))
    }
    finally {
      scanning.value = false
    }
    failed.value = errors.length > 0
    progress.value = errors.join(' ')
    return result
  }

  return { scanning, failed, progress, handleFiles }
}
