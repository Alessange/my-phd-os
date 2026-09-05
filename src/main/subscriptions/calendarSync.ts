import type { DatabaseSync } from 'node:sqlite'
import {
  buildConferenceEventInput,
  CONFERENCE_SOURCE_LABEL
} from '@shared/conferences/calendarEvent'
import { AppError } from '@shared/errors'
import type { CalendarEvent, CalendarSource } from '@shared/types/calendar'
import type { ConferenceDeadline } from '@shared/types/conference'
import * as events from '../database/repositories/calendarEvents'
import * as sources from '../database/repositories/calendarSources'
import * as deadlines from '../database/repositories/conferenceDeadlines'
import * as follows from '../database/repositories/followedConferences'

const CONFERENCE_SOURCE_COLOR = '#7c3aed'

/** The one calendar source that holds every source-managed conference deadline event. */
export const ensureConferenceSource = (db: DatabaseSync): CalendarSource =>
  sources.listSources(db).find((source) => source.type === 'conference') ??
  sources.createSource(db, {
    name: CONFERENCE_SOURCE_LABEL,
    color: CONFERENCE_SOURCE_COLOR,
    type: 'conference',
    visible: true
  })

/**
 * Adds (or re-syncs) the calendar event for a conference deadline (spec §12.7). Adding to the
 * calendar implies following: the event id lives on the follow row, which is also what keeps a
 * second add from creating a duplicate.
 */
export const addConferenceToCalendar = (db: DatabaseSync, deadlineId: string): CalendarEvent => {
  const deadline = deadlines.getConferenceDeadline(db, deadlineId)
  if (!deadline.deadlineAt || deadline.status === 'tbd') {
    throw new AppError(
      'VALIDATION',
      'This deadline is TBD upstream and has no date to put on the calendar',
      {
        id: deadlineId
      }
    )
  }
  const follow = follows.followConference(db, deadlineId)
  const source = ensureConferenceSource(db)
  const input = buildConferenceEventInput(deadline, source.id)
  if (!input) throw new AppError('VALIDATION', 'This deadline has no date', { id: deadlineId })
  const existing = follow.calendarEventId ? events.findEvent(db, follow.calendarEventId) : undefined
  if (existing) return events.updateEvent(db, existing.id, input)
  const created = events.createEvent(db, input)
  follows.updateFollow(db, deadlineId, { calendarEventId: created.id })
  return created
}

/** Removes the linked event (the follow itself stays). */
export const removeConferenceFromCalendar = (db: DatabaseSync, deadlineId: string): void => {
  const follow = follows.findFollow(db, deadlineId)
  if (!follow?.calendarEventId) return
  if (events.findEvent(db, follow.calendarEventId)) events.deleteEvent(db, follow.calendarEventId)
  follows.updateFollow(db, deadlineId, { calendarEventId: null })
}

/**
 * After an upstream change: the linked source-managed event follows the canonical record; a round
 * that became TBD loses its event (the change record keeps the previous value). User-created
 * preparation events are never touched (they have no `linkedConferenceDeadlineId`).
 */
export const syncConferenceCalendarEvent = (
  db: DatabaseSync,
  deadline: ConferenceDeadline
): void => {
  const follow = follows.findFollow(db, deadline.id)
  if (!follow?.calendarEventId) return
  const event = events.findEvent(db, follow.calendarEventId)
  if (!event) {
    follows.updateFollow(db, deadline.id, { calendarEventId: null })
    return
  }
  const input = buildConferenceEventInput(
    deadline,
    event.sourceCalendarId ?? ensureConferenceSource(db).id
  )
  if (!input) {
    events.deleteEvent(db, event.id)
    follows.updateFollow(db, deadline.id, { calendarEventId: null })
    return
  }
  events.updateEvent(db, event.id, input)
}
