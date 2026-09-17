/**
 * Guard gegen Erfolgsbehauptungen ohne Tool-Aufruf (Mistral schreibt gern «eingetragen», ohne add_maintenance
 * aufzurufen). Reine Funktion, damit sie ohne InstantDB testbar ist; `sendChatMessage` fasst bei true einmal
 * mit `toolChoice: 'required'` nach.
 */

/** Tools, die etwas speichern; Lese-Tools (list_vehicles, get_vehicle …) zählen nicht als ausgeführte Aktion */
export const WRITE_TOOLS = new Set([
  'add_vehicle',
  'update_vehicle',
  'delete_vehicle',
  'set_maintenance_schedule',
  'add_invoice',
  'delete_invoice',
  'add_maintenance',
])

// Partizip mit Hilfsverb («wurde eingetragen»), am Satzende oder vor Doppelpunkt («Wartung … eingetragen:»), oder
// hinter einem Häkchen. «erfasst» nur mit Hilfsverb: «Ich habe folgende Daten erfasst:» ist die Vorschau vor der
// Bestätigung, kein Erfolg. Fragen («eintragen?») bleiben aussen vor.
const ACTION_WORDS = 'angelegt|eingetragen|gespeichert|erfasst|gelöscht|aktualisiert|erstellt|hinzugefügt'
const DONE_WORDS = 'angelegt|eingetragen|gespeichert|gelöscht|aktualisiert|erstellt|hinzugefügt'
const ACTION_CLAIM = new RegExp(
  `\\b(?:wurde|wurden|habe ich|ist|sind)\\b[^.?]{1,80}\\b(?:${ACTION_WORDS})\\b`
  + `|\\b(?:${DONE_WORDS})\\s*(?:[:.!]|$)`
  + `|✅[^\\n]{0,80}\\b(?:${DONE_WORDS})\\b`,
  'i',
)

export interface GuardResult {
  text: string
  steps?: Array<{ toolCalls?: Array<{ toolName?: string }> }>
}

// Verneinte Sätze («noch keine Wartungen eingetragen», «kein Fahrzeug angelegt») sind Auskunft, kein Erfolg
const NEGATION = /\b(?:kein|keine|keinen|keinem|keiner|nicht|noch nicht|nichts)\b/i

export function claimsActionWithoutTool(result: GuardResult): boolean {
  const wroteSomething = (result.steps ?? []).some(s => (s.toolCalls ?? []).some(c => WRITE_TOOLS.has(c.toolName ?? '')))
  if (wroteSomething)
    return false
  const sentences = (result.text || '').split(/(?<=[.!?:])\s+|\n+/)
  return sentences.some(s => !NEGATION.test(s) && ACTION_CLAIM.test(s))
}
