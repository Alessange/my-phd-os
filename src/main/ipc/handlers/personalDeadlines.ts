import type { DatabaseSync } from 'node:sqlite'
import { buildLinkedEventInput, linkedEventPatch } from '@shared/personal-deadlines/calendarLink'
import type { PersonalDeadline } from '@shared/types/personalDeadline'
import * as events from '../../database/repositories/calendarEvents'
import * as deadlines from '../../database/repositories/personalDeadlines'
import type { Handlers } from '../registry'
import { OK } from './shared'

/**
 * Keeps a deadline's linked calendar event in step with the deadline (spec §13.5: updated in place,
 * never duplicated). A link whose event has disappeared is healed by clearing it.
 */
const syncLinkedEvent = (db: DatabaseSync, deadline: PersonalDeadline): PersonalDeadline => {
  const eventId = deadline.linkedCalendarEventId
  if (!eventId) return deadline
  const event = events.findEvent(db, eventId)
  if (!event)
    return deadlines.updatePersonalDeadline(db, deadline.id, { linkedCalendarEventId: null })
  events.updateEvent(db, event.id, linkedEventPatch(deadline, event))
  return deadline
}

export const personalDeadlineHandlers = {
  'personalDeadlines:list': (filter, ctx) => deadlines.listPersonalDeadlines(ctx.db, filter),
  'personalDeadlines:get': ({ id }, ctx) => deadlines.getPersonalDeadline(ctx.db, id),
  'personalDeadlines:create': (input, ctx) => deadlines.createPersonalDeadline(ctx.db, input),
  'personalDeadlines:update': ({ id, patch }, ctx) =>
    syncLinkedEvent(ctx.db, deadlines.updatePersonalDeadline(ctx.db, id, patch)),
  'personalDeadlines:delete': ({ id }, ctx) => {
    const deadline = deadlines.getPersonalDeadline(ctx.db, id)
    // The linked event exists only because of this deadline: remove it too, so no stray
    // "deadline" lingers on the calendar.
    const eventId = deadline.linkedCalendarEventId
    if (eventId && events.findEvent(ctx.db, eventId)) events.deleteEvent(ctx.db, eventId)
    deadlines.deletePersonalDeadline(ctx.db, id)
    return OK
  },
  'personalDeadlines:setProgress': ({ id, progress }, ctx) =>
    deadlines.setPersonalDeadlineProgress(ctx.db, id, progress),

  'personalDeadlines:linkCalendarEvent': ({ id, mode }, ctx) => {
    const deadline = deadlines.getPersonalDeadline(ctx.db, id)
    const existing = deadline.linkedCalendarEventId
      ? events.findEvent(ctx.db, deadline.linkedCalendarEventId)
      : undefined
    if (existing) {
      // Already linked: bring the same event to the requested mode instead of adding a second one.
      const event = events.updateEvent(
        ctx.db,
        existing.id,
        linkedEventPatch(deadline, existing, mode)
      )
      return { deadline, event }
    }
    const event = events.createEvent(ctx.db, buildLinkedEventInput(deadline, mode))
    try {
      const linked = deadlines.updatePersonalDeadline(ctx.db, id, {
        linkedCalendarEventId: event.id
      })
      return { deadline: linked, event }
    } catch (error) {
      // Compensate so a failed link never leaves an orphan event behind.
      events.deleteEvent(ctx.db, event.id)
      throw error
    }
  },
  'personalDeadlines:unlinkCalendarEvent': ({ id, deleteEvent }, ctx) => {
    const deadline = deadlines.getPersonalDeadline(ctx.db, id)
    const eventId = deadline.linkedCalendarEventId
    const unlinked = deadlines.updatePersonalDeadline(ctx.db, id, { linkedCalendarEventId: null })
    if (eventId && events.findEvent(ctx.db, eventId)) {
      if (deleteEvent) events.deleteEvent(ctx.db, eventId)
      else events.updateEvent(ctx.db, eventId, { linkedPersonalDeadlineId: null })
    }
    return unlinked
  }
} satisfies Partial<Handlers>
