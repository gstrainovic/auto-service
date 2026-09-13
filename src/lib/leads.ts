/**
 * Interessenten aus den Landing Pages (Validierung, business-plan/09-validierung.md M3).
 * Wird ohne Login geschrieben; die Perms erlauben für `leads` nur create.
 */
import { z } from 'zod'

export const LEAD_SEGMENTS = ['betrieb', 'privathalter'] as const
export type LeadSegment = typeof LEAD_SEGMENTS[number]

export const leadSchema = z.object({
  email: z.string().trim().email('Bitte eine gültige E-Mail-Adresse angeben.'),
  segment: z.enum(LEAD_SEGMENTS),
  note: z.string().trim().max(500).optional(),
})

export type Lead = z.infer<typeof leadSchema>
