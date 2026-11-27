import {
  CONFERENCE_STATUS_DEFINITIONS,
  DEADLINE_STATUS_DEFINITIONS,
  MILESTONE_STATUS_DEFINITIONS,
  PERSONAL_DEADLINE_STATUS_DEFINITIONS,
  PRIORITY_DEFINITIONS,
  type StatusDefinition
} from '@shared/constants/statuses'

/**
 * Every status id the badge can be given by string. Ids that appear in several maps
 * (`completed`, `not_started`, `in_progress`) have identical definitions, so merging is safe.
 */
export const STATUS_DEFINITIONS_BY_ID: Readonly<Record<string, StatusDefinition>> = {
  ...MILESTONE_STATUS_DEFINITIONS,
  ...PERSONAL_DEADLINE_STATUS_DEFINITIONS,
  ...CONFERENCE_STATUS_DEFINITIONS,
  ...DEADLINE_STATUS_DEFINITIONS
}

export const resolveStatus = (status: string | StatusDefinition): StatusDefinition | undefined =>
  typeof status === 'string' ? STATUS_DEFINITIONS_BY_ID[status] : status

export const resolvePriority = (priority: string): StatusDefinition | undefined =>
  (PRIORITY_DEFINITIONS as Record<string, StatusDefinition>)[priority]

/** Ids that deserve a glyph next to the word: exceptions and states that ask the user to act. */
const ATTENTION_STATUS_IDS: ReadonlySet<string> = new Set([
  'urgent',
  'overdue',
  'missed',
  'failed',
  'delayed',
  'invalid',
  'conflict',
  'at_risk',
  'behind',
  'completed'
])

export const isAttentionStatus = (id: string): boolean => ATTENTION_STATUS_IDS.has(id)
