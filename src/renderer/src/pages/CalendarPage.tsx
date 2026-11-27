import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useMemo, useState, type DragEvent } from 'react'
import { EMPTY_STATES } from '@shared/constants/emptyStates'
import {
  addDays,
  compareInstants,
  parseInstant,
  startOfDayInZone,
  todayInZone
} from '@shared/dates'
import {
  CALENDAR_EVENT_CATEGORIES,
  CALENDAR_VIEWS,
  type CalendarEvent,
  type CalendarEventCategory,
  type CalendarSource,
  type CalendarViewId,
  type IcsFileInput
} from '@shared/types/calendar'
import { useCommandListener } from '@renderer/app/commandBus'
import { CREATE_LABELS, useNavigation } from '@renderer/app/navigation'
import { useRegisterQuickCreate } from '@renderer/app/quickCreate'
import { EmptyState } from '@renderer/components/common/EmptyState'
import { ErrorState } from '@renderer/components/common/ErrorState'
import { LoadingState } from '@renderer/components/common/LoadingState'
import { PageAction } from '@renderer/components/common/PageAction'
import { PageHeader } from '@renderer/components/common/PageHeader'
import { Button } from '@renderer/components/ui/button'
import { SegmentedControl } from '@renderer/components/ui/segmented-control'
import {
  useCalendarEvents,
  useCalendarSources,
  useUpdateEvent
} from '@renderer/features/calendar/api'
import {
  CalendarBoard,
  type EventChange,
  type SlotSelection
} from '@renderer/features/calendar/components/CalendarBoard'
import { EventDetails } from '@renderer/features/calendar/components/EventDetails'
import { EventForm, type EventFormInitial } from '@renderer/features/calendar/components/EventForm'
import { ExportIcsDialog } from '@renderer/features/calendar/components/ExportIcsDialog'
import { FiltersPopover } from '@renderer/features/calendar/components/FiltersPopover'
import { IcsImportDialog } from '@renderer/features/calendar/components/IcsImportDialog'
import { NearestDeadlines } from '@renderer/features/calendar/components/NearestDeadlines'
import { TodayPanel } from '@renderer/features/calendar/components/TodayPanel'
import { dragHasFiles, readDroppedIcsFiles } from '@renderer/features/calendar/lib/dropFiles'
import { applyOccurrenceFilters, toFcEvents } from '@renderer/features/calendar/lib/fcEvents'
import { shiftDate } from '@renderer/features/calendar/lib/navigation'
import { useTodayHabitsProgress } from '@renderer/features/calendar/lib/useHabitsProgress'
import {
  expandOccurrences,
  occurrenceStartInstant,
  type Occurrence
} from '@renderer/features/calendar/lib/occurrences'
import { TodayHabitsCompact } from '@renderer/features/habits/components/TodayHabitsCompact'
import { useFormat } from '@renderer/hooks/useFormat'
import { useNow } from '@renderer/hooks/useNow'
import { useSettings } from '@renderer/hooks/useSettings'
import { cn } from '@renderer/lib/utils'

const VIEW_OPTIONS: readonly { value: CalendarViewId; label: string }[] = [
  { value: 'dayGridMonth', label: 'Month' },
  { value: 'timeGridWeek', label: 'Week' },
  { value: 'timeGridDay', label: 'Day' },
  { value: 'listWeek', label: 'Agenda' }
]
const isView = (value: unknown): value is CalendarViewId =>
  typeof value === 'string' && (CALENDAR_VIEWS as readonly string[]).includes(value)
const isDateKey = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

const UPCOMING_DAYS = 14
const NO_EVENTS: CalendarEvent[] = []
const NO_SOURCES: CalendarSource[] = []

interface DetailsTarget {
  key?: string
  eventId?: string
}

/** A right-panel section: an 18 px ink-2 heading (with an optional count) over its content. */
function PanelSection({
  title,
  count,
  children
}: {
  title: string
  count?: string
  children: React.ReactNode
}): React.JSX.Element {
  const id = `panel-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="flex items-baseline justify-between text-lead text-ink-2">
        {title}
        {count && <span className="tabular text-xs text-ink-3">{count}</span>}
      </h2>
      {children}
    </section>
  )
}

/**
 * Calendar (spec §9): the range title as the page headline with its toolbar (previous / next, Today,
 * the view switch, the Calendars menu); the FullCalendar board (month / week / day / agenda, create
 * by selecting, drag and resize, current-time line); the Today & Upcoming panel; `.ics` import
 * (menu, `Cmd+I`, or drop anywhere on the page) and export. The date, clock and zone live in the
 * shell's top strip; "Next: ..." is an sr-only line here, shown as the annotated Today row. Deep
 * links: `{ date }` moves the board, `{ eventId }` opens the event.
 */
export default function CalendarPage(): React.JSX.Element {
  const { settings, updateUi } = useSettings()
  const format = useFormat()
  const zone = format.zone
  const nowMinute = useNow({ precision: 'minute' })
  const todayKey = todayInZone(zone, nowMinute)
  const params = useNavigation((state) => state.params)

  const [view, setViewState] = useState<CalendarViewId>(settings.defaultCalendarView)
  const [date, setDate] = useState(todayKey)
  const [range, setRange] = useState<{ start: string; end: string } | undefined>()
  const [title, setTitle] = useState('')
  const [categories, setCategories] = useState<Set<CalendarEventCategory>>(
    () => new Set(CALENDAR_EVENT_CATEGORIES)
  )
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | undefined>()
  const [slot, setSlot] = useState<EventFormInitial | undefined>()
  const [details, setDetails] = useState<DetailsTarget | undefined>()
  const [importOpen, setImportOpen] = useState(false)
  const [dropped, setDropped] = useState<IcsFileInput[] | undefined>()
  const [exportOpen, setExportOpen] = useState(false)
  const [dragging, setDragging] = useState(false)

  const sources = useCalendarSources()
  const allEvents = useCalendarEvents(undefined)
  const rangeEvents = useCalendarEvents(
    range ? { rangeStart: range.start, rangeEnd: range.end } : undefined,
    { enabled: range !== undefined }
  )
  const updateEvent = useUpdateEvent()
  const sourceList = sources.data ?? NO_SOURCES
  const everything = allEvents.data ?? NO_EVENTS

  const boardOccurrences = useMemo(
    () =>
      range
        ? applyOccurrenceFilters(expandOccurrences(rangeEvents.data ?? NO_EVENTS, range, zone), {
            categories
          })
        : [],
    [range, rangeEvents.data, zone, categories]
  )

  const panelRange = useMemo(
    () => ({
      start: startOfDayInZone(todayKey, zone),
      end: startOfDayInZone(addDays(todayKey, UPCOMING_DAYS), zone)
    }),
    [todayKey, zone]
  )
  const panelOccurrences = useMemo(
    () => expandOccurrences(everything, panelRange, zone),
    [everything, panelRange, zone]
  )
  const todayEnd = startOfDayInZone(addDays(todayKey, 1), zone)
  const todayOccurrences = panelOccurrences.filter(
    (o) => compareInstants(occurrenceStartInstant(o, zone), todayEnd) < 0
  )
  const nextOccurrence = panelOccurrences.find(
    (o) =>
      o.event.status !== 'cancelled' &&
      compareInstants(occurrenceStartInstant(o, zone), nowMinute) > 0
  )
  const nextKey = nextOccurrence?.key
  const fcEvents = toFcEvents(boardOccurrences, { nextKey })
  // The time grid opens at 08:00, or at the earliest event's hour so that none starts out clipped.
  let firstHour = 8
  for (const o of boardOccurrences) {
    if (o.allDay) continue
    firstHour = Math.min(firstHour, parseInstant(o.startAt).setZone(zone.luxonZone).hour)
  }
  const scrollTime = `${String(firstHour).padStart(2, '0')}:00:00`
  const habitsProgress = useTodayHabitsProgress()

  const findOccurrence = (target: DetailsTarget | undefined): Occurrence | undefined => {
    if (!target) return undefined
    const pool = [...boardOccurrences, ...panelOccurrences]
    if (target.key) return pool.find((o) => o.key === target.key)
    if (target.eventId) return pool.find((o) => o.event.id === target.eventId)
    return undefined
  }
  const detailsOccurrence = findOccurrence(details)

  const setView = (next: CalendarViewId): void => {
    setViewState(next)
    void updateUi({ calendarView: next })
  }
  const goToday = useCallback(() => setDate(todayInZone(zone, nowMinute)), [zone, nowMinute])
  const openCreate = useCallback(() => {
    setSlot(undefined)
    setEditing(undefined)
    setFormOpen(true)
  }, [])
  const openImport = useCallback(() => {
    setDropped(undefined)
    setImportOpen(true)
  }, [])
  const openExport = useCallback(() => setExportOpen(true), [])
  const changeView = useCallback(
    (args: Record<string, string>) => {
      if (isView(args.view)) {
        setViewState(args.view)
        void updateUi({ calendarView: args.view })
      }
    },
    [updateUi]
  )
  useRegisterQuickCreate('calendar', openCreate)
  useCommandListener('import-ics', openImport)
  useCommandListener('calendar-today', goToday)
  useCommandListener('calendar:create', openCreate)
  useCommandListener('calendar:export', openExport)
  useCommandListener('calendar:view', changeView)

  // Deep links (derived during render; each tracks the param's current value).
  const [lastDateParam, setLastDateParam] = useState<string | undefined>()
  if (params.date !== lastDateParam) {
    setLastDateParam(params.date)
    if (isDateKey(params.date)) setDate(params.date)
  }
  const [lastEventParam, setLastEventParam] = useState<string | undefined>()
  if (params.eventId !== lastEventParam) {
    const target = params.eventId ? everything.find((e) => e.id === params.eventId) : undefined
    if (params.eventId === undefined || target) {
      setLastEventParam(params.eventId)
      if (target) {
        setDate(
          target.allDay
            ? target.startAt
            : (parseInstant(target.startAt).setZone(zone.luxonZone).toISODate() ?? todayKey)
        )
        setDetails({ eventId: target.id })
      }
    }
  }

  const onDatesSet = useCallback(
    (nextRange: { start: string; end: string }, current: string, nextTitle: string) => {
      setRange(nextRange)
      setTitle(nextTitle)
      setDate(current)
    },
    []
  )
  const onSelectSlot = useCallback((selection: SlotSelection) => {
    setSlot(selection)
    setEditing(undefined)
    setFormOpen(true)
  }, [])
  const onEventClick = useCallback((key: string) => setDetails({ key }), [])
  const onEventChange = useCallback(
    (change: EventChange, revert: () => void) => {
      const event = (rangeEvents.data ?? NO_EVENTS).find((e) => e.id === change.eventId)
      if (!event) {
        revert()
        return
      }
      const startAt = change.allDay
        ? change.startAt.slice(0, 10)
        : (parseInstant(change.startAt).toUTC().toISO() as string)
      const endAt = change.allDay
        ? change.endAt.slice(0, 10) > change.startAt.slice(0, 10)
          ? change.endAt.slice(0, 10)
          : addDays(change.startAt.slice(0, 10), 1)
        : (parseInstant(change.endAt).toUTC().toISO() as string)
      updateEvent.mutate(
        { id: event.id, patch: { startAt, endAt, allDay: change.allDay } },
        { onError: revert }
      )
    },
    [rangeEvents.data, updateEvent]
  )

  const onDragOver = (event: DragEvent<HTMLDivElement>): void => {
    if (!dragHasFiles(event.dataTransfer)) return
    event.preventDefault()
    setDragging(true)
  }
  const onDrop = async (event: DragEvent<HTMLDivElement>): Promise<void> => {
    if (!dragHasFiles(event.dataTransfer)) return
    event.preventDefault()
    setDragging(false)
    const files = await readDroppedIcsFiles(event.dataTransfer.files)
    if (files.length === 0) return
    setDropped(files)
    setImportOpen(true)
  }

  const isEmpty = allEvents.isSuccess && everything.length === 0
  const timeZone = zone.ianaName ?? 'UTC'

  let body: React.ReactNode
  if (allEvents.isPending) {
    body = <LoadingState label="Loading calendar…" />
  } else if (allEvents.isError) {
    body = (
      <ErrorState
        error={allEvents.error}
        title="Could not load your calendar"
        onRetry={() => void allEvents.refetch()}
      />
    )
  } else if (isEmpty) {
    body = (
      <div className="flex flex-1 items-start">
        <EmptyState
          title={EMPTY_STATES.calendar.title}
          description="Import an existing .ics calendar or create your first event. Week view opens by default; change it in Settings."
          actions={[
            { label: EMPTY_STATES.calendar.actions[0], onClick: openImport },
            { label: EMPTY_STATES.calendar.actions[1], onClick: openCreate }
          ]}
        />
      </div>
    )
  } else {
    body = (
      <div className="min-h-0 flex-1 pb-4">
        {rangeEvents.isError && (
          <ErrorState
            variant="compact"
            error={rangeEvents.error}
            title="Events for this range could not be loaded"
            onRetry={() => void rangeEvents.refetch()}
            className="mb-2"
          />
        )}
        <CalendarBoard
          view={view}
          date={date}
          timeZone={timeZone}
          weekStartsOn={settings.weekStartsOn}
          clock={settings.clock}
          events={fcEvents}
          scrollTime={scrollTime}
          onDatesSet={onDatesSet}
          onSelectSlot={onSelectSlot}
          onEventClick={onEventClick}
          onEventChange={onEventChange}
        />
      </div>
    )
  }

  return (
    <div
      className={cn('relative flex h-full min-h-0', dragging && 'ring-1 ring-ink ring-inset')}
      onDragOver={onDragOver}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => void onDrop(e)}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/80 text-lead text-ink">
          Drop .ics files to import
        </div>
      )}
      <PageAction>
        <Button size="sm" onClick={openCreate}>
          {CREATE_LABELS.event}
        </Button>
      </PageAction>
      <section className="flex min-w-0 flex-1 flex-col pt-[18px] pr-6 pl-10" aria-label="Calendar">
        <PageHeader title="Calendar" hideTitle className="gap-0 [&>div]:min-h-0" />
        <p className="sr-only" data-testid="calendar-now">
          {nextOccurrence
            ? `Next: ${nextOccurrence.event.title} ${format.formatRelative(occurrenceStartInstant(nextOccurrence, zone), nowMinute)}`
            : EMPTY_STATES.nextEvent.title}
        </p>
        {!isEmpty && (
          <div className="mb-2.5 flex min-h-11 flex-wrap items-center justify-between gap-x-6 gap-y-1">
            <h2
              className="min-h-11 text-display whitespace-nowrap text-ink"
              data-testid="calendar-title"
            >
              {title}
            </h2>
            <div className="app-no-drag flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous"
                onClick={() => setDate(shiftDate(date, view, -1))}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="sm" className="text-ink" onClick={goToday}>
                Today
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Next"
                onClick={() => setDate(shiftDate(date, view, 1))}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
              <SegmentedControl
                aria-label="Calendar view"
                size="sm"
                className="mr-2 ml-5"
                value={view}
                onValueChange={setView}
                options={VIEW_OPTIONS}
              />
              <FiltersPopover
                sources={sourceList}
                categories={categories}
                onCategoriesChange={setCategories}
                onImport={openImport}
                onExport={openExport}
              />
            </div>
          </div>
        )}
        {body}
      </section>

      <aside
        aria-label="Today and upcoming"
        className="hidden w-72 shrink-0 flex-col gap-7 overflow-y-auto border-l border-line pt-6 pr-8 pb-8 pl-7 min-[1180px]:flex"
      >
        <PanelSection title="Today">
          <TodayPanel
            today={todayOccurrences}
            upcoming={panelOccurrences}
            nowIso={nowMinute}
            onOpen={onEventClick}
          />
        </PanelSection>
        <PanelSection title="Nearest deadline">
          <NearestDeadlines />
        </PanelSection>
        <PanelSection
          title="Today’s habits"
          count={habitsProgress ? `${habitsProgress.done} of ${habitsProgress.total}` : undefined}
        >
          <TodayHabitsCompact />
        </PanelSection>
      </aside>

      <EventForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) {
            setEditing(undefined)
            setSlot(undefined)
          }
        }}
        event={editing}
        initial={slot}
      />
      <EventDetails
        occurrence={detailsOccurrence}
        sources={sourceList}
        open={detailsOccurrence !== undefined}
        onOpenChange={(open) => {
          if (!open) setDetails(undefined)
        }}
        onEdit={(occurrence) => {
          setDetails(undefined)
          setSlot(undefined)
          setEditing(occurrence.event)
          setFormOpen(true)
        }}
      />
      <IcsImportDialog open={importOpen} onOpenChange={setImportOpen} droppedFiles={dropped} />
      <ExportIcsDialog open={exportOpen} onOpenChange={setExportOpen} sources={sourceList} />
    </div>
  )
}
