/**
 * Täglicher Erinnerungs-Job: liest Nutzer, Fahrzeuge, Wartungen und Einstellungen über die Admin-API von InstantDB,
 * baut pro Nutzer eine E-Mail mit fälligen und überfälligen Arbeiten (src/services/reminders.ts) und sendet sie
 * über Resend. Gesendete Erinnerungen werden im Dokument `settings` des Nutzers vermerkt (lastReminderKey/At), damit
 * dieselbe Erinnerung erst nach 30 Tagen wiederkommt.
 *
 * Läuft auf der Instanz als Container (deploy/docker-compose.yml, Dienst `reminders`, Profil `jobs`), gebündelt mit
 * `npm run build:reminders` nach deploy/reminders.mjs. Umgebung: INSTANT_API_URI, INSTANT_APP_ID, INSTANT_ADMIN_TOKEN,
 * RESEND_TOKEN, optional REMINDER_FROM. Optionen: --dry-run (nichts senden, nichts schreiben), --only=<email>.
 */
import { randomUUID } from 'node:crypto'
import process from 'node:process'
import { buildReminders, shouldSend } from '../src/services/reminders'

const API = process.env.INSTANT_API_URI ?? ''
const APP_ID = process.env.INSTANT_APP_ID ?? ''
const ADMIN_TOKEN = process.env.INSTANT_ADMIN_TOKEN ?? ''
const RESEND_TOKEN = process.env.RESEND_TOKEN ?? ''
const FROM = process.env.REMINDER_FROM ?? 'Wartungsheft <erinnerung@wartungsheft.ch>'
/** Antworten landen im Postfach info@wartungsheft.ch (Infomaniak), nicht bei Resend */
const REPLY_TO = process.env.REMINDER_REPLY_TO ?? 'info@wartungsheft.ch'

const dryRun = process.argv.includes('--dry-run')
const only = process.argv.find(a => a.startsWith('--only='))?.slice('--only='.length)

function log(msg: string): void {
  console.log(`${new Date().toISOString()} ${msg}`)
}

async function admin(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${API}/admin/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'App-Id': APP_ID, 'Authorization': `Bearer ${ADMIN_TOKEN}` },
    body: JSON.stringify(body),
  })
  if (!res.ok)
    throw new Error(`Admin-API ${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function sendMail(to: string, subject: string, text: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject, text }),
  })
  if (!res.ok)
    throw new Error(`Resend: ${res.status} ${await res.text()}`)
}

async function main(): Promise<void> {
  for (const [name, value] of Object.entries({ INSTANT_API_URI: API, INSTANT_APP_ID: APP_ID, INSTANT_ADMIN_TOKEN: ADMIN_TOKEN })) {
    if (!value)
      throw new Error(`${name} fehlt`)
  }
  if (!RESEND_TOKEN && !dryRun)
    throw new Error('RESEND_TOKEN fehlt')

  const now = new Date()
  const { $users = [], vehicles = [], maintenances = [], settings = [] } = await admin('query', {
    query: { $users: {}, vehicles: {}, maintenances: {}, settings: {} },
  })
  log(`${$users.length} Nutzer, ${vehicles.length} Fahrzeuge, ${maintenances.length} Wartungen, ${settings.length} Einstellungen`)

  const reminders = buildReminders({ users: $users, vehicles, maintenances, settings, now })
    .filter(r => !only || r.email === only)
  const byUser = new Map<string, any>(settings.map((s: any) => [s.creatorId, s]))

  let sent = 0
  for (const r of reminders) {
    const setting = byUser.get(r.userId)
    if (!shouldSend(setting, r.key, now)) {
      log(`${r.email}: unverändert seit ${setting?.lastReminderAt}, keine Mail`)
      continue
    }
    if (dryRun) {
      log(`[dry-run] ${r.email}: ${r.subject}\n${r.text}\n`)
      continue
    }
    await sendMail(r.email, r.subject, r.text)
    const id = setting?.id ?? randomUUID()
    await admin('transact', {
      steps: [['update', 'settings', id, {
        creatorId: r.userId,
        lastReminderAt: now.toISOString(),
        lastReminderKey: r.key,
        updatedAt: now.toISOString(),
      }]],
    })
    sent++
    log(`${r.email}: ${r.subject}`)
  }
  log(`${sent} Erinnerung(en) gesendet, ${reminders.length - sent} übersprungen`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
