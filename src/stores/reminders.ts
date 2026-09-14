import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getCurrentUserId } from '../composables/useAuth'
import { db, id, tx } from '../lib/instantdb'

/**
 * Entität `settings`: ein Dokument pro Nutzer (creatorId). Heute nur die E-Mail-Erinnerungen; der Server-Job
 * (scripts/reminders.ts) liest `emailReminders` und schreibt `lastReminderAt`/`lastReminderKey` in dasselbe Dokument.
 * Fehlt das Dokument, sind Erinnerungen eingeschaltet.
 */
export interface UserSettings {
  id: string
  creatorId: string
  emailReminders?: boolean
  lastReminderAt?: string
  lastReminderKey?: string
  createdAt: string
  updatedAt: string
}

export const useRemindersStore = defineStore('reminders', () => {
  const settings = ref<UserSettings | null>(null)
  const loaded = ref(false)

  async function load(): Promise<void> {
    const userId = getCurrentUserId()
    const result = await db.queryOnce({ settings: { $: { where: { creatorId: userId } } } })
    settings.value = ((result?.data?.settings || []) as UserSettings[])[0] ?? null
    loaded.value = true
  }

  const emailReminders = computed(() => settings.value?.emailReminders !== false)

  async function setEmailReminders(enabled: boolean): Promise<void> {
    const now = new Date().toISOString()
    if (settings.value) {
      await db.transact([(tx.settings as any)[settings.value.id].update({ emailReminders: enabled, updatedAt: now })])
      settings.value = { ...settings.value, emailReminders: enabled, updatedAt: now }
      return
    }
    const doc: UserSettings = { id: id(), creatorId: getCurrentUserId(), emailReminders: enabled, createdAt: now, updatedAt: now }
    const { id: docId, ...attrs } = doc
    await db.transact([(tx.settings as any)[docId].update(attrs)])
    settings.value = doc
  }

  return { settings, loaded, emailReminders, load, setEmailReminders }
})
