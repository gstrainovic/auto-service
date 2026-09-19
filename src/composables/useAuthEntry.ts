import type { AuthEntry } from '../lib/known-account'
import type { LandingSegment } from '../stores/events'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { authEntry } from '../lib/known-account'
import { useEventsStore } from '../stores/events'
import { useAuth } from './useAuth'

const LABELS: Record<AuthEntry, string> = {
  app: 'Zur Übersicht',
  login: 'Anmelden',
  trial: '30 Tage gratis testen',
}

/**
 * Einstieg auf den öffentlichen Seiten: eingeloggt in die App, bekanntes Konto zum Anmelden, sonst die Testzeit.
 * Nur der Klick in die Testzeit zählt in `events`, Kunden beim Anmelden verfälschen die Auswertung sonst.
 */
export function useAuthEntry(segment?: LandingSegment) {
  const router = useRouter()
  const { user, knownEmail } = useAuth()
  const events = useEventsStore()

  const entry = computed(() => authEntry({ loggedIn: !!user.value, knownEmail: knownEmail.value }))
  const label = computed(() => LABELS[entry.value])

  function go() {
    if (entry.value === 'app') {
      router.push('/dashboard')
      return
    }
    if (entry.value === 'trial' && segment)
      events.trackCta(segment)
    router.push('/login')
  }

  return { entry, label, go }
}
