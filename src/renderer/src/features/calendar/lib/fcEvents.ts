import type { EventInput } from '@fullcalendar/core'
import { getCategory } from '@shared/constants/categories'
import type { CalendarEventCategory, CalendarSource } from '@shared/types/calendar'
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

/**
 * Source colour when the event belongs to a source, else the category token.
 *
 * The raw `--<token>` property, never the `--color-<token>` theme name: `@theme inline` resolves
 * theme names at build time and Tailwind drops any it cannot see used by a utility class, so a
 * palette colour looked up at runtime by name resolves to nothing and FullCalendar paints an
 * uncoloured box.
 */
export const occurrenceColor = (
  occurrence: Pick<Occurrence, 'event'>,
  sources: ReadonlyMap<string, CalendarSource>
): string => {
  const source = occurrence.event.sourceCalendarId
    ? sources.get(occurrence.event.sourceCalendarId)
    : undefined
  return source?.color ?? `var(--${getCategory(occurrence.event.category).colorToken})`
}

/** Maps expanded occurrences to FullCalendar inputs; series occurrences and managed events are not draggable. */
export const toFcEvents = (
  occurrences: readonly Occurrence[],
  sources: readonly CalendarSource[]
): EventInput[] => {
  const byId = new Map(sources.map((s) => [s.id, s]))
  return occurrences.map((o) => {
    const color = occurrenceColor(o, byId)
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
      backgroundColor: color,
      borderColor: color,
      textColor: '#ffffff',
      classNames: [
        cancelled ? 'fc-event-cancelled' : '',
        o.event.sourceManaged ? 'fc-event-managed' : '',
        o.recurring ? 'fc-event-recurring' : ''
      ].filter(Boolean),
      extendedProps: props
    }
  })
}
