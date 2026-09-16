/**
 * Holt den KI-Scan für offline fotografierte Belege nach: beim Start und bei jedem `online`-Ereignis.
 * Reine Logik in services/offline-scan.ts; hier nur das Nachladen, der Aufruf der KI und das Speichern.
 */
import { onMounted, onUnmounted, ref } from 'vue'
import { parseInvoice } from '../services/ai'
import { getAiAccess } from '../services/ai-access'
import { mergeScanIntoInvoice, pendingScans } from '../services/offline-scan'
import { useInvoicesStore } from '../stores/invoices'

export function useOfflineScanQueue() {
  const invoicesStore = useInvoicesStore()
  const running = ref(false)

  async function runQueue(): Promise<number> {
    if (running.value || !navigator.onLine)
      return 0
    const waiting = pendingScans(invoicesStore.invoices)
    if (!waiting.length)
      return 0
    running.value = true
    let done = 0
    try {
      const access = await getAiAccess()
      for (const invoice of waiting) {
        try {
          const parsed = await parseInvoice(invoice.imageData!, access)
          await invoicesStore.update(invoice.id, mergeScanIntoInvoice(invoice, parsed))
          done++
        }
        catch (err) {
          // Beleg bleibt markiert und kommt beim nächsten Versuch wieder dran
          console.warn('[offline-scan] Nachholen fehlgeschlagen', err)
        }
      }
    }
    catch (err) {
      console.warn('[offline-scan] kein Zugang zur KI', err)
    }
    finally {
      running.value = false
    }
    return done
  }

  function onOnline(): void {
    runQueue()
  }

  // Kein eigenes Laden: die Seiten füllen den Store, hier läuft nur das Nachholen
  onMounted(() => {
    window.addEventListener('online', onOnline)
    runQueue()
  })
  onUnmounted(() => window.removeEventListener('online', onOnline))

  return { running, runQueue }
}
