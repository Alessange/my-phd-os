import { CalendarCheck } from 'lucide-react'
import {
  conferenceSubline,
  followedTimeProgress,
  urgencyLevel,
  type UrgencyLevel
} from '@shared/conferences/views'
import { tryResolveZone } from '@shared/dates/zones'
import type { ConferenceDeadlineView } from '@shared/types/conference'
import {
  axisTicks,
  extentWindow,
  nowFractionInWindow,
  packPointLanes,
  pointInWindow
} from '@renderer/features/timeline/layout'
import { useFormat } from '@renderer/hooks/useFormat'
import { cn } from '@renderer/lib/utils'
import { DeadlineCountdown } from './DeadlineCountdown'

const BAR_FILL: Record<UrgencyLevel, string> = {
  far: 'bg-status-on-track',
  near: 'bg-status-ahead',
  soon: 'bg-status-behind',
  urgent: 'bg-status-urgent',
  passed: 'bg-status-passed',
  tbd: 'bg-transparent'
}
const DOT_FILL: Record<UrgencyLevel, string> = {
  far: 'bg-status-on-track',
  near: 'bg-status-ahead',
  soon: 'bg-status-behind',
  urgent: 'bg-status-urgent',
  passed: 'bg-status-passed',
  tbd: 'bg-status-tbd'
}
const OVERVIEW_LANE = 22

export interface ConferenceBoardProps {
  items: ConferenceDeadlineView[]
  nowIso: string
  /** Ids with unacknowledged upstream changes (small amber dot). */
  updatedIds: ReadonlySet<string>
  highlightId?: string
  onOpen: (item: ConferenceDeadlineView) => void
}

/**
 * "My conferences": one row per followed deadline — name, a start → deadline bar filled with the
 * time already gone (coloured by how close the deadline is), the dates underneath, and a big
 * countdown. A short axis above shows where the deadlines sit over the coming months. Everything
 * else is one click away in the details sheet.
 */
export function ConferenceBoard({
  items,
  nowIso,
  updatedIds,
  highlightId,
  onOpen
}: ConferenceBoardProps): React.JSX.Element {
  const format = useFormat()
  return (
    <div className="flex flex-col gap-3">
      <Overview items={items} nowIso={nowIso} onOpen={onOpen} />
      <ul className="flex flex-col gap-2" aria-label="My conferences">
        {items.map((item) => {
          const level = urgencyLevel(item, nowIso)
          const progress = followedTimeProgress(item, nowIso)
          const percent = level === 'passed' ? 100 : Math.round((progress?.fraction ?? 0) * 100)
          const start = item.followed?.followedAt ?? item.firstSeenAt
          const zoneLabel = item.originalTimezoneLabel ?? item.originalTimezone
          const zone = zoneLabel ? tryResolveZone(zoneLabel) : undefined
          const subline = conferenceSubline(item)
          const when = item.deadlineAt
            ? format.formatDateTimeWithZone(item.deadlineAt, zone)
            : 'Deadline not announced'
          const local =
            item.deadlineAt && zone && zone.ianaName !== format.zone.ianaName
              ? format.formatDateTimeWithZone(item.deadlineAt)
              : undefined
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpen(item)}
                aria-label={item.title}
                data-conference-id={item.id}
                data-urgency={level}
                data-highlighted={item.id === highlightId || undefined}
                className={cn(
                  'grid w-full grid-cols-[minmax(8rem,13rem)_minmax(0,1fr)_5.5rem] items-center gap-4 rounded-lg border bg-card px-4 py-3 text-left shadow-xs transition-colors outline-none hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring',
                  item.id === highlightId && 'ring-2 ring-ring',
                  level === 'passed' && 'opacity-70'
                )}
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{item.title}</span>
                    {item.followed?.calendarEventId && (
                      <CalendarCheck
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-label="On your calendar"
                      />
                    )}
                    {updatedIds.has(item.id) && (
                      <span
                        className="size-2 shrink-0 rounded-full bg-status-at-risk"
                        role="img"
                        aria-label="Updated from CCF Deadlines"
                        title="Updated from CCF Deadlines"
                      />
                    )}
                  </span>
                  {subline && (
                    <span className="truncate text-[11px] text-muted-foreground">{subline}</span>
                  )}
                </span>

                <span className="flex min-w-0 flex-col gap-1">
                  <span
                    role="progressbar"
                    aria-label="Time elapsed since you followed"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={level === 'tbd' ? undefined : percent}
                    className={cn(
                      'relative block h-3 overflow-hidden rounded-full bg-muted',
                      level === 'tbd' && 'border border-dashed border-status-tbd/60 bg-transparent'
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn('absolute inset-y-0 left-0 rounded-full', BAR_FILL[level])}
                      style={{ width: `${percent}%` }}
                    />
                    {level !== 'tbd' && level !== 'passed' && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-0 w-0.5 bg-foreground/70"
                        style={{ left: `calc(${percent}% - 1px)` }}
                      />
                    )}
                  </span>
                  <span className="tabular flex justify-between gap-2 text-[10px] text-muted-foreground">
                    <span className="truncate">{format.formatDate(start)}</span>
                    <span className="truncate text-right">
                      {when}
                      {local && <span className="ml-1.5 opacity-80">· {local}</span>}
                    </span>
                  </span>
                </span>

                <DeadlineCountdown targetIso={item.deadlineAt} status={item.status} />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Overview({
  items,
  nowIso,
  onOpen
}: Pick<ConferenceBoardProps, 'items' | 'nowIso' | 'onOpen'>): React.JSX.Element | null {
  const format = useFormat()
  const dated = items.filter((i) => i.deadlineAt && i.status !== 'tbd')
  if (dated.length === 0) return null
  const window = extentWindow(
    dated.map((i) => ({
      id: i.id,
      title: i.title,
      startAt: i.deadlineAt as string,
      targetAt: i.deadlineAt as string,
      progress: 0
    })),
    nowIso,
    { minDays: 120, padDays: 7 }
  )
  const ticks = axisTicks(window, 'semester', format.zone, format.settings.weekStartsOn)
  const nowFrac = nowFractionInWindow(nowIso, window)
  const points = dated.flatMap((item) => {
    const fraction = pointInWindow(item.deadlineAt as string, window)
    return fraction === null ? [] : [{ item, fraction }]
  })
  const lanes = packPointLanes(
    points.map((p) => ({ id: p.item.id, fraction: p.fraction })),
    0.16
  )
  const pct = (ms: number): string =>
    `${((ms - window.startMs) / (window.endMs - window.startMs)) * 100}%`

  return (
    <div
      role="figure"
      aria-label="Deadlines over the coming months"
      className="overflow-hidden rounded-lg border bg-card shadow-xs"
    >
      <div className="relative h-6 border-b border-border">
        {ticks
          .filter((t) => t.major)
          .map((t) => (
            <span
              key={t.ms}
              className="absolute top-1 -translate-x-1/2 text-[10px] whitespace-nowrap text-muted-foreground"
              style={{ left: pct(t.ms) }}
            >
              {t.label}
            </span>
          ))}
      </div>
      <div className="relative" style={{ height: lanes.count * OVERVIEW_LANE + 10 }}>
        {ticks.map((t) => (
          <span
            key={`${t.major ? 'M' : 'm'}${t.ms}`}
            aria-hidden="true"
            className={cn('absolute inset-y-0 w-px', t.major ? 'bg-border' : 'bg-border/40')}
            style={{ left: pct(t.ms) }}
          />
        ))}
        {nowFrac !== null && (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 z-10 w-px bg-primary"
            style={{ left: `${nowFrac * 100}%` }}
          />
        )}
        {points.map(({ item, fraction }) => {
          const level = urgencyLevel(item, nowIso)
          const lane = lanes.laneOf.get(item.id) ?? 0
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpen(item)}
              title={`${item.title} · ${format.formatDateTime(item.deadlineAt as string)}`}
              aria-label={`${item.title} on the timeline`}
              className="absolute z-[2] flex max-w-40 -translate-x-1/2 items-center gap-1 rounded-sm px-1 text-[10px] leading-tight whitespace-nowrap outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              style={{
                left: `${Math.min(Math.max(fraction, 0.04), 0.96) * 100}%`,
                top: lane * OVERVIEW_LANE + 5,
                height: OVERVIEW_LANE - 4
              }}
            >
              <span
                aria-hidden="true"
                className={cn('size-2.5 shrink-0 rounded-full ring-2 ring-card', DOT_FILL[level])}
              />
              <span className="truncate">{item.conferenceName ?? item.title}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
