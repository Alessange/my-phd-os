import { CalendarCheck, CircleAlert } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { conferenceSubline, deadlineProgress, urgencyLevel } from '@shared/conferences/views'
import { tryResolveZone } from '@shared/dates/zones'
import type { ConferenceDeadlineView } from '@shared/types/conference'
import { StatusMark } from '@renderer/components/ui/status-mark'
import { Row } from '@renderer/components/ui/row'
import {
  axisTicks,
  extentWindow,
  nowFractionInWindow,
  pointInWindow
} from '@renderer/features/timeline/layout'
import { useFormat } from '@renderer/hooks/useFormat'
import { cn } from '@renderer/lib/utils'
import { DeadlineCountdown } from './DeadlineCountdown'

/** Share of the axis one conference name needs; names closer than this move to the other side. */
const LABEL_GAP = 0.09

export interface ConferenceBoardProps {
  items: ConferenceDeadlineView[]
  nowIso: string
  /** Ids with unacknowledged upstream changes (a quiet `Updated` word on the row). */
  updatedIds: ReadonlySet<string>
  highlightId?: string
  onOpen: (item: ConferenceDeadlineView) => void
  /** Rendered between the axis strip and the rows (the `Following 7` heading). */
  header?: ReactNode
}

/**
 * "Following": the conferences you chose as hairline rows under one ink rule. The first upcoming,
 * dated one leads with a 64 px countdown; every other row is a title, its ranks, the local date and
 * a 28 px `9 d 09 h`. The original-timezone line is in the DOM (and spoken) on every row and shown on
 * hover and focus. A 2 px line on the row's lower edge is the time gone since you added it. The
 * months axis above places the same deadlines on one real timeline.
 */
export function ConferenceBoard({
  items,
  nowIso,
  updatedIds,
  highlightId,
  onOpen,
  header
}: ConferenceBoardProps): React.JSX.Element {
  const lead = items.find((i) => i.status === 'upcoming' && i.deadlineAt)
  return (
    <div className="flex flex-col gap-4">
      <Axis items={items} nowIso={nowIso} onOpen={onOpen} />
      <div className="flex flex-col gap-3">
        {header}
        <ul
          className="flex flex-col divide-y divide-line border-t border-ink"
          aria-label="My conferences"
        >
          {items.map((item) => (
            <li key={item.id}>
              <ConferenceRow
                item={item}
                nowIso={nowIso}
                lead={item.id === lead?.id}
                updated={updatedIds.has(item.id)}
                highlighted={item.id === highlightId}
                onOpen={onOpen}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

interface ConferenceRowProps {
  item: ConferenceDeadlineView
  nowIso: string
  lead: boolean
  updated: boolean
  highlighted: boolean
  onOpen: (item: ConferenceDeadlineView) => void
}

function ConferenceRow({
  item,
  nowIso,
  lead,
  updated,
  highlighted,
  onOpen
}: ConferenceRowProps): React.JSX.Element {
  const format = useFormat()
  const id = useId()
  const level = urgencyLevel(item, nowIso)
  const progress = deadlineProgress(item, nowIso)
  const percent = progress === undefined ? undefined : Math.round(progress * 100)
  const zoneLabel = item.originalTimezoneLabel ?? item.originalTimezone
  const zone = zoneLabel ? tryResolveZone(zoneLabel) : undefined
  const subline = conferenceSubline(item)
  const localText = item.deadlineAt ? format.formatDateTimeWithZone(item.deadlineAt) : undefined
  const originalText =
    item.deadlineAt && zone ? format.formatDateTimeWithZone(item.deadlineAt, zone) : undefined
  // The original line only exists when it differs from what the local line already says.
  const original = originalText && originalText !== localText ? originalText : undefined
  const urgent = level === 'urgent'
  const passed = level === 'passed'
  const showBar = percent !== undefined && !passed

  return (
    <Row asChild density={lead ? 'lead' : 'two-line'} selected={highlighted}>
      <button
        type="button"
        onClick={() => onOpen(item)}
        aria-label={item.title}
        aria-describedby={`${id}-when ${id}-left`}
        data-conference-id={item.id}
        data-urgency={level}
        data-highlighted={highlighted || undefined}
        className={cn(
          'grid items-start gap-x-8 gap-y-1 outline-offset-[-2px]',
          // Lead and rows share one template (DESIGN.md: title / date / countdown), so every date
          // starts on the same edge. The countdown column is as wide as the 64 px hero needs and
          // right-aligns the smaller row figures.
          'grid-cols-[minmax(0,1fr)_auto] min-[1100px]:grid-cols-[minmax(0,1fr)_260px_280px] min-[1100px]:items-center',
          !lead && 'py-1'
        )}
      >
        <span
          className={cn(
            'row-start-1 flex min-w-0 flex-col min-[1100px]:col-span-1 min-[1100px]:col-start-1',
            lead ? 'col-span-2 gap-1' : 'col-span-1 gap-0'
          )}
        >
          <span className="flex min-w-0 items-baseline gap-3">
            <span
              className={cn(
                'line-clamp-2 min-w-0',
                lead ? 'text-title text-ink' : 'text-lead',
                !lead && (passed ? 'text-ink-3' : 'text-ink')
              )}
              title={item.title}
            >
              {item.title}
            </span>
            {item.followed?.calendarEventId && (
              <CalendarCheck
                className="size-3.5 shrink-0 translate-y-0.5 text-ink-3"
                aria-label="On your calendar"
              />
            )}
            {updated && (
              <span
                role="img"
                aria-label="Updated from CCF Deadlines"
                title="Updated from CCF Deadlines"
                className="text-meta shrink-0 text-ink-3"
              >
                Updated
              </span>
            )}
          </span>
          {subline && (
            <span className={cn('truncate text-ink-3', lead ? 'text-body' : 'text-meta')}>
              {subline}
            </span>
          )}
          {percent !== undefined && !passed && (
            <span className={cn(lead ? 'text-meta text-ink-3' : 'sr-only')}>
              {percent}% of the way there
            </span>
          )}
        </span>

        <span
          id={`${id}-when`}
          className={cn(
            'col-start-1 row-start-2 flex min-w-0 flex-col min-[1100px]:col-start-2 min-[1100px]:row-start-1',
            lead ? 'mt-3 gap-1 min-[1100px]:mt-0' : 'gap-0.5'
          )}
        >
          {!localText ? (
            <span className="text-body text-ink-3 italic">Waiting for a date</span>
          ) : lead && original ? (
            <span className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1">
              <span className="text-meta text-ink-3">Local</span>
              <span className="text-body tabular text-ink-2">{localText}</span>
              <span className="text-meta text-ink-3">Original</span>
              <span className="text-body tabular text-ink-2" data-zoned="original">
                {original}
              </span>
            </span>
          ) : (
            <>
              <span className="text-body tabular text-ink-2" data-zoned="local">
                {localText}
              </span>
              {original && (
                <span
                  className="text-meta tabular text-ink-3 opacity-0 transition-opacity duration-100 group-focus-within/row:opacity-100 group-hover/row:opacity-100"
                  data-zoned="original"
                >
                  Original {original}
                </span>
              )}
            </>
          )}
        </span>

        <span
          id={`${id}-left`}
          className={cn(
            'col-start-2 flex flex-col items-end gap-2 text-right min-[1100px]:col-start-3 min-[1100px]:row-span-1 min-[1100px]:row-start-1',
            lead ? 'row-start-2 mt-3 min-[1100px]:mt-0' : 'row-span-2 row-start-1'
          )}
        >
          <DeadlineCountdown
            targetIso={item.deadlineAt}
            status={item.status}
            size={lead ? 'hero' : 'row'}
          />
          {urgent && (
            <StatusMark
              label="Urgent"
              colorToken="status-urgent"
              size="md"
              glyph={<CircleAlert aria-hidden="true" />}
            />
          )}
        </span>

        {showBar && (
          <span
            role="progressbar"
            aria-label="Time gone since you added this conference"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="pointer-events-none absolute inset-x-0 bottom-0 block h-0.5"
          >
            <span
              aria-hidden="true"
              className="block h-full bg-progress-time transition-[width] duration-150"
              style={{ width: `${percent}%` }}
            />
          </span>
        )}
      </button>
    </Row>
  )
}

/**
 * The months axis: a 1 px line with one 9 px dot per dated conference (hollow once passed) and its
 * name, alternating above and below the line so names never collide, month labels underneath. The
 * dots are not tab stops (the rows are), so the figure adds no keyboard noise.
 */
function Axis({
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
  const ticks = axisTicks(window, 'year', format.zone, format.settings.weekStartsOn).filter(
    (t) => t.major
  )
  const nowFrac = nowFractionInWindow(nowIso, window)
  const pct = (ms: number): string =>
    `${((ms - window.startMs) / (window.endMs - window.startMs)) * 100}%`

  // Names alternate above (side 0) and below (side 1) the line; a name goes to the first side with room.
  const lastOnSide = [-1, -1]
  const placed = dated
    .flatMap((item) => {
      const fraction = pointInWindow(item.deadlineAt as string, window)
      return fraction === null ? [] : [{ item, fraction }]
    })
    .sort((a, b) => a.fraction - b.fraction)
    .map(({ item, fraction }) => {
      const free = [0, 1].find((side) => fraction - (lastOnSide[side] ?? -1) >= LABEL_GAP)
      const side = free ?? ((lastOnSide[0] ?? -1) <= (lastOnSide[1] ?? -1) ? 0 : 1)
      lastOnSide[side] = fraction
      return { item, fraction, side }
    })

  return (
    <div
      role="figure"
      aria-label="Deadlines over the coming months"
      className="relative h-[68px] select-none"
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-[28px] h-px bg-line-strong" />
      {ticks.map((t, index) => (
        <span key={t.ms}>
          <span
            aria-hidden="true"
            className="absolute top-[28px] h-[5px] w-px bg-edge"
            style={{ left: pct(t.ms) }}
          />
          <span
            className={cn(
              'text-meta absolute top-[52px] whitespace-nowrap text-ink-3',
              // Narrow windows show every second month so labels never touch.
              index % 2 === 1 && 'max-[1099px]:hidden'
            )}
            style={{ left: pct(t.ms) }}
          >
            {index === 0 || t.label.startsWith('Jan') ? t.label : t.label.split(' ')[0]}
          </span>
        </span>
      ))}
      {nowFrac !== null && nowFrac > 0.04 && (
        <span
          aria-hidden="true"
          className="absolute top-[22px] h-[13px] w-px bg-ink"
          style={{ left: `${nowFrac * 100}%` }}
        />
      )}
      {placed.map(({ item, fraction, side }) => {
        const passed = item.status === 'passed'
        const rightEdge = fraction > 0.88
        return (
          <span key={item.id}>
            <span
              aria-hidden="true"
              className={cn(
                'absolute top-[28px] size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full',
                passed ? 'border border-ink-3 bg-background' : 'bg-ink'
              )}
              style={{ left: `${fraction * 100}%` }}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => onOpen(item)}
              title={`${item.title} · ${format.formatDateTime(item.deadlineAt as string)}`}
              aria-label={`${item.title} on the timeline`}
              data-conference-id={item.id}
              className={cn(
                'text-meta absolute whitespace-nowrap',
                passed ? 'text-ink-3' : 'text-ink-2',
                side === 0 ? 'top-[4px]' : 'top-[33px]',
                rightEdge ? '-translate-x-full pr-0.5' : 'pl-0.5'
              )}
              style={{
                left: `calc(${fraction * 100}% ${rightEdge ? '+ 4px' : '- 4px'})`
              }}
            >
              {item.conferenceName ?? item.title}
            </button>
          </span>
        )
      })}
    </div>
  )
}
