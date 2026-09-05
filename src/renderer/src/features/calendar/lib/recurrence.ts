import { RRule, rrulestr } from 'rrule'
import { DateTime } from 'luxon'

/**
 * Small, honest recurrence model for the event editor: a handful of presets plus a raw RRULE for
 * anything else. Rules imported from `.ics` files are kept verbatim; the editor shows them as
 * "custom" text unless they match a preset exactly.
 */

export const RECURRENCE_PRESETS = [
  'none',
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'yearly',
  'custom'
] as const
export type RecurrencePreset = (typeof RECURRENCE_PRESETS)[number]

export const RECURRENCE_PRESET_LABELS: Readonly<Record<RecurrencePreset, string>> = {
  none: 'Does not repeat',
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  yearly: 'Yearly',
  custom: 'Custom RRULE'
}

export type RecurrenceEnd =
  { kind: 'never' } | { kind: 'until'; date: string } | { kind: 'count'; count: number }

export interface RecurrenceDraft {
  preset: RecurrencePreset
  end: RecurrenceEnd
  /** Raw RRULE text for `custom`. */
  custom: string
}

const WEEKDAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const

/** Builds the RRULE text (without the `RRULE:` prefix) from the draft and the event's start date key. */
export const buildRecurrenceRule = (
  draft: RecurrenceDraft,
  startDateKey: string
): string | undefined => {
  if (draft.preset === 'none') return undefined
  if (draft.preset === 'custom') return draft.custom.trim().replace(/^RRULE:/i, '') || undefined
  const start = DateTime.fromISO(startDateKey, { zone: 'utc' })
  const parts: string[] = []
  switch (draft.preset) {
    case 'daily':
      parts.push('FREQ=DAILY')
      break
    case 'weekly':
      parts.push('FREQ=WEEKLY', `BYDAY=${WEEKDAY_CODES[start.weekday - 1]}`)
      break
    case 'biweekly':
      parts.push('FREQ=WEEKLY', 'INTERVAL=2', `BYDAY=${WEEKDAY_CODES[start.weekday - 1]}`)
      break
    case 'monthly':
      parts.push('FREQ=MONTHLY', `BYMONTHDAY=${start.day}`)
      break
    case 'yearly':
      parts.push('FREQ=YEARLY')
      break
  }
  if (draft.end.kind === 'until') parts.push(`UNTIL=${draft.end.date.replace(/-/g, '')}T235959Z`)
  if (draft.end.kind === 'count') parts.push(`COUNT=${Math.max(1, Math.round(draft.end.count))}`)
  return parts.join(';')
}

const parseEnd = (rule: string): RecurrenceEnd => {
  const until = /UNTIL=(\d{4})(\d{2})(\d{2})/.exec(rule)
  if (until) return { kind: 'until', date: `${until[1]}-${until[2]}-${until[3]}` }
  const count = /COUNT=(\d+)/.exec(rule)
  if (count) return { kind: 'count', count: Number(count[1]) }
  return { kind: 'never' }
}

/** Recognises rules the editor produced (any part order); everything else is `custom`. */
export const recurrenceDraftFromRule = (
  rule: string | undefined,
  startDateKey: string
): RecurrenceDraft => {
  if (!rule) return { preset: 'none', end: { kind: 'never' }, custom: '' }
  const end = parseEnd(rule)
  const stripped = rule
    .split(';')
    .filter((part) => !/^(UNTIL|COUNT)=/.test(part))
    .sort()
    .join(';')
  const candidates: RecurrencePreset[] = ['daily', 'weekly', 'biweekly', 'monthly', 'yearly']
  for (const preset of candidates) {
    const built = buildRecurrenceRule({ preset, end: { kind: 'never' }, custom: '' }, startDateKey)
    if (built && built.split(';').sort().join(';') === stripped) return { preset, end, custom: '' }
  }
  return { preset: 'custom', end: { kind: 'never' }, custom: rule }
}

/** Validates a raw RRULE with the rrule library; returns the problem, or undefined when fine. */
export const validateRecurrenceRule = (rule: string): string | undefined => {
  const text = rule.trim().replace(/^RRULE:/i, '')
  if (!text) return 'Enter a rule such as FREQ=WEEKLY;BYDAY=MO,WE'
  if (!/FREQ=/i.test(text)) return 'A rule needs a FREQ part (DAILY, WEEKLY, MONTHLY or YEARLY)'
  try {
    rrulestr(`RRULE:${text}`)
    return undefined
  } catch (error) {
    return error instanceof Error ? error.message : 'The rule could not be parsed'
  }
}

/** Human sentence for a rule (`every week on Tuesday until December 15, 2026`), or the raw rule. */
export const describeRecurrence = (rule: string | undefined): string | undefined => {
  if (!rule) return undefined
  try {
    return RRule.fromString(rule).toText()
  } catch {
    return rule
  }
}
