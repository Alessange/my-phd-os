import type {
  DateSelectArg,
  DatesSetArg,
  EventClickArg,
  EventDropArg,
  EventInput
} from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, { type EventResizeDoneArg } from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import luxon3Plugin from '@fullcalendar/luxon3'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { useEffect, useRef } from 'react'
import type { CalendarViewId } from '@shared/types/calendar'
import type { ClockFormat, WeekStart } from '@shared/types/settings'
import type { FcExtendedProps } from '../lib/fcEvents'
import '../calendar.css'

export interface SlotSelection {
  startAt: string
  endAt: string
  allDay: boolean
}

export interface EventChange {
  eventId: string
  startAt: string
  endAt: string
  allDay: boolean
}

export interface CalendarBoardProps {
  view: CalendarViewId
  /** Date key the board should show; the parent moves it with Today / previous / next. */
  date: string
  /** IANA zone name or `UTC` (FullCalendar's luxon plugin resolves it). */
  timeZone: string
  weekStartsOn: WeekStart
  clock: ClockFormat
  events: EventInput[]
  onDatesSet: (range: { start: string; end: string }, current: string, title: string) => void
  onSelectSlot: (slot: SlotSelection) => void
  onEventClick: (occurrenceKey: string) => void
  onEventChange: (change: EventChange, revert: () => void) => void
}

/**
 * The FullCalendar surface (spec §9.2): month / week / day / list, slot selection to create,
 * click to open, drag and resize to move (series occurrences and source-managed events are fixed),
 * current-time indicator, week start and clock from settings, times displayed in the app zone.
 * Toolbar and navigation live in the page; this component only mirrors `view` and `date`.
 */
export function CalendarBoard({
  view,
  date,
  timeZone,
  weekStartsOn,
  clock,
  events,
  onDatesSet,
  onSelectSlot,
  onEventClick,
  onEventChange
}: CalendarBoardProps): React.JSX.Element {
  const ref = useRef<FullCalendar>(null)

  useEffect(() => {
    const api = ref.current?.getApi()
    if (api && api.view.type !== view) api.changeView(view)
  }, [view])

  useEffect(() => {
    const api = ref.current?.getApi()
    if (!api) return
    // With a named zone the API's Date is the wall clock expressed as UTC: compare date keys.
    if (api.getDate().toISOString().slice(0, 10) !== date) api.gotoDate(date)
  }, [date])

  const timeFormat = clock === '24h' ? 'HH:mm' : 'h:mm a'

  const changed = (arg: EventDropArg | EventResizeDoneArg): void => {
    const props = arg.event.extendedProps as FcExtendedProps
    const startAt = arg.event.startStr
    const endAt = arg.event.endStr || arg.event.startStr
    onEventChange({ eventId: props.eventId, startAt, endAt, allDay: arg.event.allDay }, arg.revert)
  }

  return (
    <div className="h-full min-h-[480px]" data-testid="calendar-board">
      <FullCalendar
        ref={ref}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, luxon3Plugin]}
        initialView={view}
        initialDate={date}
        timeZone={timeZone}
        firstDay={weekStartsOn}
        headerToolbar={false}
        height="100%"
        expandRows
        nowIndicator
        selectable
        selectMirror
        unselectAuto
        editable
        eventResizableFromStart
        dayMaxEvents={4}
        weekNumbers={false}
        scrollTime="08:00:00"
        slotDuration="00:30:00"
        eventTimeFormat={timeFormat}
        slotLabelFormat={timeFormat}
        allDayText="all-day"
        noEventsContent="No events in this range"
        eventDisplay="block"
        events={events}
        datesSet={(arg: DatesSetArg) =>
          onDatesSet(
            { start: arg.startStr, end: arg.endStr },
            arg.view.calendar.getDate().toISOString().slice(0, 10),
            arg.view.title
          )
        }
        select={(arg: DateSelectArg) =>
          onSelectSlot({ startAt: arg.startStr, endAt: arg.endStr, allDay: arg.allDay })
        }
        eventClick={(arg: EventClickArg) => {
          arg.jsEvent.preventDefault()
          onEventClick((arg.event.extendedProps as FcExtendedProps).occurrenceKey)
        }}
        eventDrop={changed}
        eventResize={changed}
      />
    </div>
  )
}
