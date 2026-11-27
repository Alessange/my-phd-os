import type {
  DateSelectArg,
  DatesSetArg,
  DayHeaderContentArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
  EventInput
} from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, { type EventResizeDoneArg } from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import luxon3Plugin from '@fullcalendar/luxon3'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { Lock, Repeat } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { CalendarViewId } from '@shared/types/calendar'
import type { ClockFormat, WeekStart } from '@shared/types/settings'
import type { FcExtendedProps } from '../lib/fcEvents'
import { makeListRowKeyboardActivatable } from '../lib/listRowKeyboard'
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
  /** Where the time grid first scrolls to (`HH:00:00`); the page lowers it so the earliest event is never clipped. */
  scrollTime?: string
  onDatesSet: (range: { start: string; end: string }, current: string, title: string) => void
  onSelectSlot: (slot: SlotSelection) => void
  onEventClick: (occurrenceKey: string) => void
  onEventChange: (change: EventChange, revert: () => void) => void
}

/**
 * Week header: the weekday (13 px ink-3) over a 28 px numeral; today's numeral sits on an ink disc
 * (`calendar.css`). The text comes from `dayHeaderFormat` (`Mon 23`), so it follows the locale, and
 * falls back to the raw text when it cannot be split.
 */
const renderDayHeader = (arg: DayHeaderContentArg): React.ReactNode => {
  // `Mon 23` or `23 Mon`, depending on the locale.
  const text = arg.text.trim()
  const weekdayFirst = /^(\D+?)\s*(\d{1,2})$/.exec(text)
  const dayFirst = /^(\d{1,2})\s*(\D+)$/.exec(text)
  const weekday = weekdayFirst?.[1] ?? dayFirst?.[2]
  const day = weekdayFirst?.[2] ?? dayFirst?.[1]
  if (!weekday || !day) return arg.text
  return (
    <>
      <span className="cal-wd">{weekday}</span>
      <span className="cal-dn">{day}</span>
    </>
  )
}

/**
 * One mark for every view: glyphs (lock for source-managed, repeat for recurring), the title and,
 * where there is room, the time. Colour never carries meaning, and the states a glyph or a
 * strike-through shows are also spoken (sr-only), so none of them is told by sight alone.
 */
const renderEventContent = (arg: EventContentArg): React.ReactNode => {
  const props = arg.event.extendedProps as Partial<FcExtendedProps>
  const title = (
    <span className="cal-ev-title">
      {props.cancelled && <span className="sr-only">Cancelled: </span>}
      {props.sourceManaged && (
        <>
          <Lock className="cal-glyph" aria-hidden="true" />
          <span className="sr-only">Managed by a subscription: </span>
        </>
      )}
      {props.recurring && (
        <>
          <Repeat className="cal-glyph cal-glyph-repeat" aria-hidden="true" />
          <span className="sr-only">Repeats: </span>
        </>
      )}
      {arg.event.title}
    </span>
  )
  // The agenda prints the time in its own column.
  if (arg.view.type.startsWith('list')) return title
  const time = arg.timeText && !arg.event.allDay ? arg.timeText : undefined
  // Month rows and all-day marks ellipsise: the tooltip carries the full title (and the time).
  const tooltip = time ? `${time} ${arg.event.title}` : arg.event.title
  if (arg.view.type.startsWith('dayGrid')) {
    return (
      <div className="cal-ev" title={tooltip}>
        {time && <span className="cal-ev-time">{time}</span>}
        {title}
      </div>
    )
  }
  return (
    <div className="cal-ev" title={tooltip}>
      {title}
      {time && <div className="cal-ev-time">{time}</div>}
    </div>
  )
}

/**
 * The FullCalendar surface (spec §9.2): month / week / day / list, slot selection to create,
 * click to open, drag and resize to move (series occurrences and source-managed events are fixed),
 * current-time indicator, week start and clock from settings, times displayed in the app zone.
 * Toolbar and navigation live in the page; this component only mirrors `view` and `date`.
 * Events are neutral ink-wash marks (see `calendar.css`); the next event alone has a Bold title.
 */
export function CalendarBoard({
  view,
  date,
  timeZone,
  weekStartsOn,
  clock,
  events,
  scrollTime = '08:00:00',
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
        nowIndicator
        selectable
        selectMirror
        unselectAuto
        editable
        eventResizableFromStart
        dayMaxEvents={3}
        weekNumbers={false}
        scrollTime={scrollTime}
        slotDuration="00:30:00"
        defaultRangeSeparator=" – "
        eventTimeFormat={timeFormat}
        slotLabelFormat={timeFormat}
        allDayText="all-day"
        noEventsContent="No events in this range"
        views={{
          dayGridMonth: { expandRows: true, dayHeaderFormat: { weekday: 'short' } },
          timeGridWeek: {
            dayHeaderFormat: { weekday: 'short', day: 'numeric', omitCommas: true },
            dayHeaderContent: renderDayHeader
          },
          // The range title already names the day: the single header would only repeat it.
          timeGridDay: { dayHeaders: false },
          listWeek: {
            listDayFormat: { weekday: 'long' },
            listDaySideFormat: { month: 'short', day: 'numeric', year: 'numeric' }
          }
        }}
        eventContent={renderEventContent}
        eventDidMount={makeListRowKeyboardActivatable}
        // FullCalendar puts aria-expanded on a role-less anchor, which ARIA does not allow.
        moreLinkDidMount={(arg) => arg.el.setAttribute('role', 'button')}
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
