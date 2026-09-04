import type { IsoInstant } from './common'
import type { CalendarEvent } from './calendar'

export const PERSONAL_DEADLINE_CATEGORIES = [
  'paper',
  'course',
  'scholarship',
  'internship',
  'academic',
  'administrative',
  'personal',
  'other'
] as const
export type PersonalDeadlineCategory = (typeof PERSONAL_DEADLINE_CATEGORIES)[number]

export const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const
export type Priority = (typeof PRIORITIES)[number]

export const PERSONAL_DEADLINE_STATUSES = [
  'not_started',
  'in_progress',
  'completed',
  'missed'
] as const
export type PersonalDeadlineStatus = (typeof PERSONAL_DEADLINE_STATUSES)[number]

export interface PersonalDeadline {
  id: string
  title: string
  description?: string

  trackingStartAt: IsoInstant
  deadlineAt: IsoInstant
  timezone: string

  category: PersonalDeadlineCategory
  priority: Priority
  status: PersonalDeadlineStatus

  /** Manually entered work completion, 0–100. */
  progress: number

  sourceUrl?: string
  location?: string
  tags?: string[]

  linkedMilestoneId?: string
  linkedCalendarEventId?: string

  createdAt: IsoInstant
  updatedAt: IsoInstant
}

/** Computed (never stored) status from `deadline-status/calculateDeadlineStatus`. */
export const DEADLINE_STATUSES = [
  'completed',
  'overdue',
  'urgent',
  'at_risk',
  'behind',
  'ahead',
  'on_track'
] as const
export type DeadlineStatus = (typeof DEADLINE_STATUSES)[number]

export type DeadlineCalendarLinkMode = 'allDay' | 'exact'

export interface LinkCalendarEventResult {
  deadline: PersonalDeadline
  event: CalendarEvent
}
