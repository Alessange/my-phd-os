import { EMPTY_STATES } from '@shared/constants/emptyStates'
import { compareInstants } from '@shared/dates'
import { EmptyState } from '@renderer/components/common/EmptyState'
import { useFormat } from '@renderer/hooks/useFormat'
import { cn } from '@renderer/lib/utils'
import { occurrenceEndInstant, occurrenceStartInstant, type Occurrence } from '../lib/occurrences'

export interface TodayPanelProps {
  /** Occurrences overlapping today (display zone). */
  today: Occurrence[]
  /** Occurrences from now onwards (today included), used to find the next event. */
  upcoming: Occurrence[]
  nowIso: string
  onOpen: (occurrenceKey: string) => void
}

/** `in 12 minutes` becomes `in 12 min`, `in 3 hours` becomes `in 3 h`: the panel is 288 px wide. */
const shorten = (phrase: string): string =>
  phrase
    .replace(/(\d+) minutes?/, '$1 min')
    .replace(/(\d+) hours?/, '$1 h')
    .replace(/(\d+) days?/, '$1 d')

/**
 * Right-panel "Today" (spec 9.4): one flat list. Past rows are dimmed, the active row says `now`,
 * and the next event is the one Bold row, annotated with how far away it is (`data-testid=next-event`).
 * When the next event is not today it sits below the list instead.
 */
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
  const isPast = (o: Occurrence): boolean =>
    !o.allDay && compareInstants(occurrenceEndInstant(o, zone), nowIso) <= 0
  const next = upcoming.find(
    (o) =>
      o.event.status !== 'cancelled' && compareInstants(occurrenceStartInstant(o, zone), nowIso) > 0
  )
  const nextIsToday = next !== undefined && today.some((o) => o.key === next.key)
  const away = (o: Occurrence): string =>
    shorten(format.formatRelative(occurrenceStartInstant(o, zone), nowIso))

  return (
    <div className="flex flex-col gap-3">
      {today.length === 0 ? (
        <EmptyState variant="compact" title={EMPTY_STATES.todayEvents.title} />
      ) : (
        <ul className="flex flex-col" aria-label="Today's events">
          {today.map((occurrence) => {
            const active = isActive(occurrence)
            const isNext = next?.key === occurrence.key
            const cancelled = occurrence.event.status === 'cancelled'
            return (
              <li key={occurrence.key} data-testid={isNext ? 'next-event' : undefined}>
                <button
                  type="button"
                  onClick={() => onOpen(occurrence.key)}
                  className="group/row grid w-full grid-cols-[3.5rem_1fr] items-baseline gap-x-2 py-1.5 text-left"
                  data-active={active || undefined}
                >
                  <span className="tabular text-xs text-ink-3">
                    {occurrence.allDay ? 'all-day' : format.formatTime(occurrence.startAt)}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        'text-sm group-hover/row:underline',
                        isPast(occurrence) && !isNext && 'text-ink-2',
                        isNext && 'font-bold',
                        cancelled && 'text-ink-3 line-through'
                      )}
                    >
                      {occurrence.event.title}
                    </span>
                    {isNext && (
                      <span className="ml-2 text-xs whitespace-nowrap text-ink-2">
                        {away(occurrence)}
                      </span>
                    )}
                    {active && <span className="ml-2 text-xs text-ink-2">now</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {next && !nextIsToday && (
        <div data-testid="next-event" className="border-t border-line pt-3">
          <button
            type="button"
            onClick={() => onOpen(next.key)}
            className="group/row flex w-full flex-col items-start text-left"
          >
            <span className="min-w-0">
              <span className="text-sm font-bold group-hover/row:underline">
                {next.event.title}
              </span>
              <span className="ml-2 text-xs whitespace-nowrap text-ink-2">{away(next)}</span>
            </span>
            <span className="tabular text-xs text-ink-3">
              {next.allDay ? format.formatDate(next.startAt) : format.formatDateTime(next.startAt)}
            </span>
          </button>
        </div>
      )}
      {!next && today.length > 0 && (
        <EmptyState variant="compact" title={EMPTY_STATES.nextEvent.title} />
      )}
    </div>
  )
}
