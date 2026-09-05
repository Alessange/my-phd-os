import { CalendarDays, ChevronLeft, ChevronRight, Download, Import, Plus } from 'lucide-react'
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
import { useNavigation } from '@renderer/app/navigation'
import { useRegisterQuickCreate } from '@renderer/app/quickCreate'
import { EmptyState } from '@renderer/components/common/EmptyState'
import { ErrorState } from '@renderer/components/common/ErrorState'
import { LoadingState } from '@renderer/components/common/LoadingState'
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
import { TodayPanel } from '@renderer/features/calendar/components/TodayPanel'
import { dragHasFiles, readDroppedIcsFiles } from '@renderer/features/calendar/lib/dropFiles'
import { applyOccurrenceFilters, toFcEvents } from '@renderer/features/calendar/lib/fcEvents'
import { shiftDate } from '@renderer/features/calendar/lib/navigation'
import {
  expandOccurrences,
  occurrenceStartInstant,
  type Occurrence
} from '@renderer/features/calendar/lib/occurrences'
import { FollowedConferenceCompact } from '@renderer/features/conference-deadlines/components/FollowedConferenceCompact'
import { TodayHabitsCompact } from '@renderer/features/habits/components/TodayHabitsCompact'
import { PersonalDeadlineCompact } from '@renderer/features/personal-deadlines/components/PersonalDeadlineCompact'
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

function PanelSection({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section aria-labelledby={`panel-${title}`} className="flex flex-col gap-2">
      <h2
        id={`panel-${title}`}
        className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

/**
 * Calendar (spec §9): toolbar with today's date, live clock, active zone and the next event; the
 * FullCalendar board (month / week / day / agenda, create by selecting, drag and resize, current-time
 * indicator, category and source filters); the Today & Upcoming panel; `.ics` import (native picker
 * or drop anywhere on the page) and export. Deep links: `{ date }` moves the board, `{ eventId }` opens
 * the event.
 */
export default function CalendarPage(): React.JSX.Element {
  const { settings, updateUi } = useSettings()
  const format = useFormat()
  const zone = format.zone
  const nowMinute = useNow({ precision: 'minute' })
  const nowSecond = useNow({ precision: 'second' })
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
  const fcEvents = useMemo(
    () => toFcEvents(boardOccurrences, sourceList),
    [boardOccurrences, sourceList]
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
    (o) => compareInstants(occurrenceStartInstant(o, zone), nowMinute) > 0
  )

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
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={CalendarDays}
          title={EMPTY_STATES.calendar.title}
          description="Import an existing .ics calendar or create your first event. Week view opens by default; change it in Settings."
          actions={[
            {
              label: EMPTY_STATES.calendar.actions[0],
              onClick: openImport,
              variant: 'outline',
              icon: Import
            },
            {
              label: EMPTY_STATES.calendar.actions[1],
              onClick: openCreate,
              variant: 'default',
              icon: Plus
            }
          ]}
        />
      </div>
    )
  } else {
    body = (
      <div className="min-h-0 flex-1 px-4 pb-4">
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
      className={cn('relative flex h-full min-h-0', dragging && 'ring-2 ring-primary ring-inset')}
      onDragOver={onDragOver}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => void onDrop(e)}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/70 text-sm font-medium">
          Drop .ics files to import
        </div>
      )}
      <section className="flex min-w-0 flex-1 flex-col" aria-labelledby="calendar-heading">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
          <div className="min-w-0">
            <h1 id="calendar-heading" className="text-[15px] font-semibold">
              Calendar
            </h1>
            <p
              className="tabular truncate text-xs text-muted-foreground"
              data-testid="calendar-now"
            >
              {format.formatWeekday(todayKey)} · {format.formatDate(todayKey)} ·{' '}
              {format.formatClock(nowSecond)} {format.formatZoneLabel(nowSecond)}
              {nextOccurrence
                ? ` · Next: ${nextOccurrence.event.title} ${format.formatRelative(occurrenceStartInstant(nextOccurrence, zone), nowMinute)}`
                : ` · ${EMPTY_STATES.nextEvent.title}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FiltersPopover
              sources={sourceList}
              categories={categories}
              onCategoriesChange={setCategories}
            />
            <Button variant="outline" size="sm" onClick={openExport}>
              <Download aria-hidden="true" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={openImport}>
              <Import aria-hidden="true" />
              Import .ics
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus aria-hidden="true" />
              Add Event
            </Button>
          </div>
        </div>
        {!isEmpty && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-2">
            <SegmentedControl
              aria-label="Calendar view"
              size="sm"
              value={view}
              onValueChange={setView}
              options={VIEW_OPTIONS}
            />
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                aria-label="Previous"
                onClick={() => setDate(shiftDate(date, view, -1))}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToday} disabled={date === todayKey}>
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label="Next"
                onClick={() => setDate(shiftDate(date, view, 1))}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
            <span className="text-sm font-medium" data-testid="calendar-title">
              {title}
            </span>
          </div>
        )}
        {body}
      </section>

      <aside
        aria-label="Today and upcoming"
        className="hidden w-80 shrink-0 flex-col gap-5 overflow-y-auto border-l bg-sidebar/40 p-4 min-[1180px]:flex"
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
          <PersonalDeadlineCompact />
          <FollowedConferenceCompact />
        </PanelSection>
        <PanelSection title="Today’s habits">
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
