/**
 * Diktat: aufnehmen, an den AI-Proxy schicken, Text zurückbekommen (`/me/transcribe`, Voxtral).
 * Ein Baustein für alle Stellen — Chat-Eingabe, Freitextfelder, ganze Rechnung ansagen.
 *
 * Grenzen aus der Messung (`stt-vergleich.md`): ganze Sätze werden gut erkannt, einzelne Fachwörter schlecht,
 * Kennzeichen und Beträge nur im Satzzusammenhang. Darum gibt es kein Diktat für Zahlenfelder.
 */
import { onBeforeUnmount, readonly, ref } from 'vue'
import { transcribeAudio } from '../services/ai-access'

/** Länger als drei Minuten nimmt der Proxy nicht an */
const MAX_SEKUNDEN = 180

export function useDictation() {
  const laeuft = ref(false)
  const verarbeitet = ref(false)
  const sekunden = ref(0)
  const fehler = ref('')
  const verfuegbar = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'

  let recorder: MediaRecorder | null = null
  let ticker: ReturnType<typeof setInterval> | null = null
  // Wird beim Stoppen mit der fertigen Aufnahme aufgerufen
  let blobFertig: ((b: Blob) => void) | null = null

  function aufraeumen(): void {
    recorder?.stream.getTracks().forEach(t => t.stop())
    recorder = null
    laeuft.value = false
    if (ticker) {
      clearInterval(ticker)
      ticker = null
    }
  }

  /** Startet die Aufnahme; das Ergebnis kommt erst beim Stoppen */
  async function starten(): Promise<void> {
    fehler.value = ''
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const teile: Blob[] = []
      recorder = new MediaRecorder(stream)
      recorder.ondataavailable = e => e.data.size && teile.push(e.data)
      recorder.addEventListener('stop', () => {
        blobFertig?.(new Blob(teile, { type: recorder?.mimeType || 'audio/webm' }))
      })
      recorder.start()
      laeuft.value = true
      sekunden.value = 0
      ticker = setInterval(() => {
        sekunden.value++
        if (sekunden.value >= MAX_SEKUNDEN)
          void stoppen()
      }, 1000)
    }
    catch {
      fehler.value = 'Kein Zugriff aufs Mikrofon. Bitte tippen.'
      aufraeumen()
    }
  }

  /** Stoppt die Aufnahme und liefert den erkannten Text; null bei Abbruch oder Fehler */
  async function stoppen(): Promise<string | null> {
    if (!recorder || recorder.state !== 'recording')
      return null
    const blob = await new Promise<Blob>((resolve) => {
      blobFertig = resolve
      recorder?.stop()
    })
    aufraeumen()
    if (!blob.size)
      return null

    verarbeitet.value = true
    try {
      const { text } = await transcribeAudio(blob)
      return text.trim() || null
    }
    catch (e) {
      fehler.value = (e as Error).message
      return null
    }
    finally {
      verarbeitet.value = false
    }
  }

  function abbrechen(): void {
    blobFertig = () => {}
    if (recorder?.state === 'recording')
      recorder.stop()
    aufraeumen()
  }

  onBeforeUnmount(abbrechen)

  return {
    verfuegbar,
    laeuft: readonly(laeuft),
    verarbeitet: readonly(verarbeitet),
    sekunden: readonly(sekunden),
    fehler,
    starten,
    stoppen,
    abbrechen,
  }
}
