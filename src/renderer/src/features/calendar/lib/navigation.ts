import { DateTime } from 'luxon'
import type { CalendarViewId } from '@shared/types/calendar'

/** Date key shown after Previous / Next for a view: a month, a week, or a day. */
export const shiftDate = (dateKey: string, view: CalendarViewId, direction: -1 | 1): string => {
  const date = DateTime.fromISO(dateKey, { zone: 'utc' })
  const moved =
    view === 'dayGridMonth'
      ? date.plus({ months: direction })
      : view === 'timeGridDay'
        ? date.plus({ days: direction })
        : date.plus({ weeks: direction })
  return moved.toISODate() as string
}
