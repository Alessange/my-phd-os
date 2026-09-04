import type { IcsDuplicateReason } from '../types/calendar'
import type { ConferenceStatus, RefreshOutcomeStatus } from '../types/conference'
import type { MilestoneStatus } from '../types/milestone'
import type { DeadlineStatus, PersonalDeadlineStatus, Priority } from '../types/personalDeadline'

export interface StatusDefinition<Id extends string = string> {
  id: Id
  label: string
  /** lucide-react component name. */
  icon: string
  /** Tailwind theme color token from `globals.css` (`bg-<token>/15 text-<token>`). */
  colorToken: string
}

const define = <Id extends string>(
  id: Id,
  label: string,
  icon: string,
  colorToken: string
): StatusDefinition<Id> => ({
  id,
  label,
  icon,
  colorToken
})

/** Computed personal deadline status (spec §13.2). Colors follow ARCHITECTURE §9. */
export const DEADLINE_STATUS_DEFINITIONS: Readonly<
  Record<DeadlineStatus, StatusDefinition<DeadlineStatus>>
> = {
  ahead: define('ahead', 'Ahead', 'TrendingUp', 'status-ahead'),
  on_track: define('on_track', 'On Track', 'CircleCheck', 'status-on-track'),
  behind: define('behind', 'Behind', 'TrendingDown', 'status-behind'),
  at_risk: define('at_risk', 'At Risk', 'TriangleAlert', 'status-at-risk'),
  urgent: define('urgent', 'Urgent', 'Siren', 'status-urgent'),
  completed: define('completed', 'Completed', 'CheckCheck', 'status-completed'),
  overdue: define('overdue', 'Overdue', 'CircleX', 'status-overdue')
}

/** Stored (user-set) personal deadline status. */
export const PERSONAL_DEADLINE_STATUS_DEFINITIONS: Readonly<
  Record<PersonalDeadlineStatus, StatusDefinition<PersonalDeadlineStatus>>
> = {
  not_started: define('not_started', 'Not started', 'Circle', 'status-neutral'),
  in_progress: define('in_progress', 'In progress', 'CircleDot', 'status-on-track'),
  completed: define('completed', 'Completed', 'CheckCheck', 'status-completed'),
  missed: define('missed', 'Missed', 'CircleX', 'status-overdue')
}

export const PRIORITY_DEFINITIONS: Readonly<Record<Priority, StatusDefinition<Priority>>> = {
  low: define('low', 'Low', 'ArrowDown', 'priority-low'),
  medium: define('medium', 'Medium', 'Minus', 'priority-medium'),
  high: define('high', 'High', 'ArrowUp', 'priority-high'),
  critical: define('critical', 'Critical', 'Flame', 'priority-critical')
}

export const CONFERENCE_STATUS_DEFINITIONS: Readonly<
  Record<ConferenceStatus, StatusDefinition<ConferenceStatus>>
> = {
  upcoming: define('upcoming', 'Upcoming', 'CalendarClock', 'status-on-track'),
  passed: define('passed', 'Passed', 'History', 'status-passed'),
  tbd: define('tbd', 'TBD', 'CircleHelp', 'status-tbd')
}

export const MILESTONE_STATUS_DEFINITIONS: Readonly<
  Record<MilestoneStatus, StatusDefinition<MilestoneStatus>>
> = {
  not_started: define('not_started', 'Not started', 'Circle', 'status-neutral'),
  in_progress: define('in_progress', 'In progress', 'CircleDot', 'status-on-track'),
  completed: define('completed', 'Completed', 'CheckCheck', 'status-completed'),
  delayed: define('delayed', 'Delayed', 'Clock', 'status-overdue')
}

/** Per-event classification shown in the .ics import preview. */
export type IcsImportItemStatus = 'new' | 'duplicate' | 'conflict' | 'invalid'

export const ICS_IMPORT_ITEM_STATUS_DEFINITIONS: Readonly<
  Record<IcsImportItemStatus, StatusDefinition<IcsImportItemStatus>>
> = {
  new: define('new', 'New', 'Plus', 'status-ahead'),
  duplicate: define('duplicate', 'Duplicate', 'Copy', 'status-behind'),
  conflict: define('conflict', 'Conflict', 'TriangleAlert', 'status-at-risk'),
  invalid: define('invalid', 'Invalid', 'CircleX', 'status-overdue')
}

export const ICS_DUPLICATE_REASON_LABELS: Readonly<Record<IcsDuplicateReason, string>> = {
  uid: 'Same UID',
  recurrenceId: 'Same UID and recurrence instance',
  startInstant: 'Same title and start time',
  source: 'Same source and start time'
}

export const REFRESH_OUTCOME_DEFINITIONS: Readonly<
  Record<RefreshOutcomeStatus, StatusDefinition<RefreshOutcomeStatus>>
> = {
  updated: define('updated', 'Updated', 'RefreshCw', 'status-ahead'),
  unchanged: define('unchanged', 'Unchanged', 'Check', 'status-neutral'),
  failed: define('failed', 'Failed', 'CircleX', 'status-overdue'),
  skipped: define('skipped', 'Skipped', 'CircleSlash', 'status-passed')
}
