/**
 * Kontolöschung (AGB): erst löscht die App alle eigenen Daten über den Client (die Perms erlauben nur eigene
 * Einträge), dann entfernt der AI-Proxy Verbrauch, Testzeit und das Login (`POST /me/delete`). Reihenfolge
 * bewusst: nach dem Löschen des Logins wäre keine Transaktion mehr möglich.
 */
import { db, tx } from '../lib/instantdb'
import { deleteAccount } from './ai-access'

/** Entitäten mit `creatorId`; `events` gehört keinem Nutzer, `usage` und `subscriptions` räumt der Proxy */
export const OWNED_ENTITIES = ['vehicles', 'invoices', 'maintenances', 'chatmessages', 'ocrcache', 'settings'] as const

/** Löschbefehle für alles, was die Abfrage geliefert hat; reine Funktion, damit sie testbar bleibt */
export function deleteOps(data: Record<string, { id: string }[] | undefined>, txs: any = tx): unknown[] {
  return OWNED_ENTITIES.flatMap(name => (data[name] ?? []).map(row => txs[name][row.id].delete()))
}

export async function deleteAccountData(): Promise<number> {
  const query = Object.fromEntries(OWNED_ENTITIES.map(name => [name, {}]))
  const result = await db.queryOnce(query as any)
  const ops = deleteOps(result.data as any)
  if (ops.length)
    await db.transact(ops as any)
  return ops.length
}

/** Alles weg: eigene Daten, dann Verbrauch und Login beim Proxy */
export async function deleteWholeAccount(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine)
    throw new Error('Offline: Zum Löschen des Kontos braucht es eine Verbindung.')
  await deleteAccountData()
  await deleteAccount()
}
