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

export type KnownStatusId = keyof typeof DEADLINE_STATUS_DEFINITIONS &
  keyof typeof PERSONAL_DEADLINE_STATUS_DEFINITIONS &
  keyof typeof CONFERENCE_STATUS_DEFINITIONS &
  keyof typeof MILESTONE_STATUS_DEFINITIONS

export const resolveStatus = (status: string | StatusDefinition): StatusDefinition | undefined =>
  typeof status === 'string' ? STATUS_DEFINITIONS_BY_ID[status] : status

export const resolvePriority = (priority: string): StatusDefinition | undefined =>
  (PRIORITY_DEFINITIONS as Record<string, StatusDefinition>)[priority]
