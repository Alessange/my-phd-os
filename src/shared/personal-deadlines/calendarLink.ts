import { addDays, dateKeyInZone } from '../dates/allDay'
import type { CreateCalendarEventInput, UpdateCalendarEventInput } from '../schemas/calendar'
import type { CalendarEvent } from '../types/calendar'
import type { DeadlineCalendarLinkMode, PersonalDeadline } from '../types/personalDeadline'

/**
 * Pure mapping from a personal deadline to its linked calendar event (spec §13.5). The deadline is
 * the source of truth: the event carries the deadline's title, description, location and source
 * URL, and either the whole local day of the deadline (`allDay`, in the deadline's own zone) or the
 * exact instant (`exact`, a point event). `linkedPersonalDeadlineId` lets the calendar navigate back.
 */

export type LinkedEventTimes = Pick<
  CreateCalendarEventInput,
  'startAt' | 'endAt' | 'allDay' | 'timezone'
>

export const linkedEventTimes = (
  deadline: Pick<PersonalDeadline, 'deadlineAt' | 'timezone'>,
  mode: DeadlineCalendarLinkMode
): LinkedEventTimes => {
  if (mode === 'allDay') {
    const day = dateKeyInZone(deadline.deadlineAt, deadline.timezone)
    // All-day ends are exclusive (iCalendar semantics): one day = [day, day + 1).
    return { startAt: day, endAt: addDays(day, 1), allDay: true, timezone: deadline.timezone }
  }
  return {
    startAt: deadline.deadlineAt,
    endAt: deadline.deadlineAt,
    allDay: false,
    timezone: deadline.timezone
  }
}

/** The mode an existing linked event was created with. */
export const linkModeOf = (event: Pick<CalendarEvent, 'allDay'>): DeadlineCalendarLinkMode =>
  event.allDay ? 'allDay' : 'exact'

/** Fields copied from the deadline on every sync. */
const derivedFields = (
  deadline: PersonalDeadline
): Pick<CreateCalendarEventInput, 'title' | 'description' | 'location' | 'url'> => ({
  title: deadline.title,
  description: deadline.description,
  location: deadline.location,
  url: deadline.sourceUrl
})

/** Input for a brand-new linked event. */
export const buildLinkedEventInput = (
  deadline: PersonalDeadline,
  mode: DeadlineCalendarLinkMode
): CreateCalendarEventInput & { sourceManaged: boolean } => ({
  ...derivedFields(deadline),
  ...linkedEventTimes(deadline, mode),
  category: 'deadline',
  linkedPersonalDeadlineId: deadline.id,
  sourceManaged: false
})

/**
 * Patch that brings an existing linked event back in sync after the deadline changed, keeping the
 * event's mode unless a new one is requested. Never creates a second event (spec §13.5).
 */
export const linkedEventPatch = (
  deadline: PersonalDeadline,
  event: Pick<CalendarEvent, 'allDay'>,
  mode: DeadlineCalendarLinkMode = linkModeOf(event)
): UpdateCalendarEventInput => ({
  ...derivedFields(deadline),
  ...linkedEventTimes(deadline, mode),
  linkedPersonalDeadlineId: deadline.id
})
