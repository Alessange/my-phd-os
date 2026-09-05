import { CalendarDays, Clock } from 'lucide-react'
import { EMPTY_STATES } from '@shared/constants/emptyStates'
import { getCategory } from '@shared/constants/categories'
import { compareInstants } from '@shared/dates'
import { Countdown } from '@renderer/components/common/Countdown'
import { EmptyState } from '@renderer/components/common/EmptyState'
import { useFormat } from '@renderer/hooks/useFormat'
import { chipStyle, cn } from '@renderer/lib/utils'
import { occurrenceEndInstant, occurrenceStartInstant, type Occurrence } from '../lib/occurrences'

export interface TodayPanelProps {
  /** Occurrences overlapping today (display zone). */
  today: Occurrence[]
  /** Occurrences from now onwards (today included), used to find the next event. */
  upcoming: Occurrence[]
  nowIso: string
  onOpen: (occurrenceKey: string) => void
}

/** Right-panel "Today" (spec §9.4): today's events, the active one, and the next event with its countdown. */
export function TodayPanel({
  today,
  upcoming,
  nowIso,
  onOpen
}: TodayPanelProps): React.JSX.Element {
  const format = useFormat()
  const zone = format.zone
  const isActive = (o: Occurrence): boolean =>
    compareInstants(occurrenceStartInstant(o, zone), nowIso) <= 0 &&
    compareInstants(occurrenceEndInstant(o, zone), nowIso) > 0
  const next = upcoming.find((o) => compareInstants(occurrenceStartInstant(o, zone), nowIso) > 0)

  return (
    <div className="flex flex-col gap-3">
      {today.length === 0 ? (
        <EmptyState variant="compact" icon={CalendarDays} title={EMPTY_STATES.todayEvents.title} />
      ) : (
        <ul className="flex flex-col gap-1" aria-label="Today's events">
          {today.map((occurrence) => {
            const active = isActive(occurrence)
            const category = getCategory(occurrence.event.category)
            return (
              <li key={occurrence.key}>
                <button
                  type="button"
                  onClick={() => onOpen(occurrence.key)}
                  style={chipStyle(category.colorToken)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-accent',
                    active && 'bg-accent/70 ring-1 ring-(--chip)/40'
                  )}
                  data-active={active || undefined}
                >
                  <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-(--chip)" />
                  <span className="tabular w-16 shrink-0 text-xs text-muted-foreground">
                    {occurrence.allDay ? 'all-day' : format.formatTime(occurrence.startAt)}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate',
                      occurrence.event.status === 'cancelled' &&
                        'line-through text-muted-foreground'
                    )}
                  >
                    {occurrence.event.title}
                  </span>
                  {active && (
                    <span className="shrink-0 text-[10px] font-semibold text-(--chip) uppercase">
                      now
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <div className="rounded-md border bg-card px-3 py-2 shadow-xs" data-testid="next-event">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          <Clock className="size-3" aria-hidden="true" />
          Next event
        </div>
        {next ? (
          <button
            type="button"
            onClick={() => onOpen(next.key)}
            className="mt-1 flex w-full flex-col items-start rounded-sm text-left hover:underline"
          >
            <span className="w-full truncate text-[13px] font-medium">{next.event.title}</span>
            <span className="tabular text-xs text-muted-foreground">
              {next.allDay ? format.formatDate(next.startAt) : format.formatDateTime(next.startAt)}
            </span>
            <span className="text-xs">
              in{' '}
              <Countdown
                targetIso={occurrenceStartInstant(next, zone)}
                variant="inline"
                className="font-medium"
              />
            </span>
          </button>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">{EMPTY_STATES.nextEvent.title}</p>
        )}
      </div>
    </div>
  )
}
