import type { EventInput } from '@fullcalendar/core'
import type { CalendarEventCategory } from '@shared/types/calendar'
import type { Occurrence } from './occurrences'

/** What a FullCalendar event carries back to us in `extendedProps`. */
export interface FcExtendedProps {
  occurrenceKey: string
  eventId: string
  recurring: boolean
  sourceManaged: boolean
  cancelled: boolean
}

export interface OccurrenceFilters {
  /** Categories to show; undefined shows all. */
  categories?: ReadonlySet<CalendarEventCategory>
  /** Source ids hidden by the user in this session (persisted visibility is applied by the query). */
  hiddenSourceIds?: ReadonlySet<string>
  /** Show cancelled events (default true). */
  showCancelled?: boolean
}

export const applyOccurrenceFilters = (
  occurrences: readonly Occurrence[],
  filters: OccurrenceFilters
): Occurrence[] =>
  occurrences.filter((o) => {
    if (filters.categories && !filters.categories.has(o.event.category)) return false
    if (
      filters.hiddenSourceIds &&
      o.event.sourceCalendarId &&
      filters.hiddenSourceIds.has(o.event.sourceCalendarId)
    )
      return false
    if (filters.showCancelled === false && o.event.status === 'cancelled') return false
    return true
  })

/** Options for `toFcEvents`. */
export interface FcEventOptions {
  /** Occurrence key of the next event; it alone gets the Bold title (`fc-event-next`). */
  nextKey?: string
}

/**
 * Maps expanded occurrences to FullCalendar inputs; series occurrences and managed events are not
 * draggable. Events carry no colour at all: they are neutral ink-wash marks (`calendar.css`),
 * told apart by title, time, position and state (`fc-event-cancelled|managed|recurring|next`).
 * The stored source colour is shown only as a dot in the Calendars menu.
 */
export const toFcEvents = (
  occurrences: readonly Occurrence[],
  options: FcEventOptions = {}
): EventInput[] =>
  occurrences.map((o) => {
    const cancelled = o.event.status === 'cancelled'
    const props: FcExtendedProps = {
      occurrenceKey: o.key,
      eventId: o.event.id,
      recurring: o.recurring,
      sourceManaged: o.event.sourceManaged,
      cancelled
    }
    return {
      id: o.key,
      title: o.event.title,
      start: o.startAt,
      end: o.endAt,
      allDay: o.allDay,
      editable: !o.recurring && !o.event.sourceManaged,
      classNames: [
        cancelled ? 'fc-event-cancelled' : '',
        o.event.sourceManaged ? 'fc-event-managed' : '',
        o.recurring ? 'fc-event-recurring' : '',
        options.nextKey === o.key ? 'fc-event-next' : ''
      ].filter(Boolean),
      extendedProps: props
    }
  })
