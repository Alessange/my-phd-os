import { addDays } from '../dates/allDay'
import type { CreateCalendarEventInput } from '../schemas/calendar'
import type { ConferenceDeadline } from '../types/conference'

export const CONFERENCE_SOURCE_LABEL = 'CCF Deadlines'

/**
 * The source-managed calendar event for a conference deadline (spec §12.7): the conference title,
 * the exact deadline instant in its original timezone, a link back to the record and to the
 * homepage, marked as a deadline from CCF Deadlines. The user never edits its instant; the
 * subscription refresh keeps it in sync.
 */
export const buildConferenceEventInput = (
  deadline: ConferenceDeadline,
  sourceCalendarId: string
): (CreateCalendarEventInput & { sourceManaged: boolean }) | undefined => {
  if (!deadline.deadlineAt || deadline.status === 'tbd') return undefined
  const descriptionLines = [
    deadline.fullName,
    deadline.conferenceDatesText ? `Conference dates: ${deadline.conferenceDatesText}` : undefined,
    deadline.comment ? `Round: ${deadline.comment}` : undefined,
    deadline.originalTimezoneLabel
      ? `Original deadline timezone: ${deadline.originalTimezoneLabel}`
      : undefined,
    `Source: ${CONFERENCE_SOURCE_LABEL} (${deadline.sourceUrl})`
  ].filter((line): line is string => Boolean(line))
  const day = deadline.deadlineAt.slice(0, 10)
  return {
    title: deadline.title,
    description: descriptionLines.join('\n'),
    startAt: deadline.allDay ? day : deadline.deadlineAt,
    endAt: deadline.allDay ? addDays(day, 1) : deadline.deadlineAt,
    timezone: deadline.originalTimezone ?? 'UTC',
    allDay: deadline.allDay,
    category: 'deadline',
    location: deadline.location,
    sourceCalendarId,
    linkedConferenceDeadlineId: deadline.id,
    sourceManaged: true,
    sourceLabel: CONFERENCE_SOURCE_LABEL,
    url: deadline.homepageUrl
  }
}
