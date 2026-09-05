import { getCategory } from '@shared/constants/categories'
import { DEADLINE_STATUS_DEFINITIONS } from '@shared/constants/statuses'
import type { DescribedDeadline } from '@shared/personal-deadlines/views'
import type { PersonalDeadline } from '@shared/types/personalDeadline'
import {
  axisTicks,
  barLayout,
  extentWindow,
  nowFractionInWindow,
  packLanes,
  type TimeSpan
} from '@renderer/features/timeline/layout'
import { useFormat } from '@renderer/hooks/useFormat'
import { chipStyle, cn } from '@renderer/lib/utils'

const LANE_HEIGHT = 40
const BAR_HEIGHT = 32
const PADDING = 8
const DAY_MS = 24 * 60 * 60 * 1000

const toSpan = (d: PersonalDeadline): TimeSpan => ({
  id: d.id,
  title: d.title,
  startAt: d.trackingStartAt,
  targetAt: d.deadlineAt,
  progress: d.progress
})

export interface PersonalDeadlineTimelineProps {
  items: DescribedDeadline[]
  nowIso: string
  onOpen: (deadline: PersonalDeadline) => void
}

/**
 * Timeline view (spec §13.3): each deadline is a bar from its tracking start to the deadline,
 * filled to work progress, with today's tick, on a shared axis that always includes today.
 * Reuses the milestone layout maths so both timelines read the same way.
 */
export function PersonalDeadlineTimeline({
  items,
  nowIso,
  onOpen
}: PersonalDeadlineTimelineProps): React.JSX.Element {
  const format = useFormat()
  const spans = items.map((item) => toSpan(item.deadline))
  const window = extentWindow(spans, nowIso, { minDays: 60, padDays: 3 })
  const view = (window.endMs - window.startMs) / DAY_MS <= 200 ? 'semester' : 'year'
  const ticks = axisTicks(window, view, format.zone, format.settings.weekStartsOn)
  const nowFrac = nowFractionInWindow(nowIso, window)
  const lanes = packLanes(spans)
  const pct = (ms: number): string =>
    `${((ms - window.startMs) / (window.endMs - window.startMs)) * 100}%`

  return (
    <div className="flex flex-col gap-2">
      <div
        role="figure"
        aria-label="Deadline timeline"
        className="overflow-hidden rounded-lg border bg-card shadow-xs"
      >
        <div className="relative h-7 border-b border-border">
          {ticks
            .filter((t) => t.major)
            .map((t) => (
              <span
                key={t.ms}
                className="absolute top-1.5 -translate-x-1/2 text-[10px] whitespace-nowrap text-muted-foreground"
                style={{ left: pct(t.ms) }}
              >
                {t.label}
              </span>
            ))}
          {nowFrac !== null && (
            <span
              className="absolute top-1 z-10 -translate-x-1/2 rounded-sm bg-primary px-1 text-[9px] font-semibold text-primary-foreground"
              style={{ left: `${nowFrac * 100}%` }}
            >
              Today
            </span>
          )}
        </div>
        <div className="relative" style={{ height: lanes.count * LANE_HEIGHT + PADDING }}>
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
              className="absolute inset-y-0 z-10 w-px bg-primary/70"
              style={{ left: `${nowFrac * 100}%` }}
            />
          )}
          {items.map(({ deadline, computed }) => {
            const layout = barLayout(toSpan(deadline), window, nowIso)
            if (!layout.inWindow) return null
            const category = getCategory(deadline.category)
            const overdue = computed.status === 'overdue'
            const completed = deadline.status === 'completed'
            const statusLabel = DEADLINE_STATUS_DEFINITIONS[computed.status].label
            return (
              <button
                key={deadline.id}
                type="button"
                onClick={() => onOpen(deadline)}
                aria-label={`${deadline.title}, ${deadline.progress}% complete, ${statusLabel}`}
                title={`${deadline.title} · due ${format.formatDateTimeWithZone(deadline.deadlineAt, deadline.timezone)} · ${deadline.progress}% done`}
                data-deadline-id={deadline.id}
                className={cn(
                  'absolute flex flex-col justify-center overflow-hidden rounded-md border text-left transition-shadow outline-none hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring',
                  overdue ? 'border-status-overdue' : 'border-(--chip)/40',
                  completed && 'opacity-75'
                )}
                style={{
                  left: `${layout.left * 100}%`,
                  width: `max(${layout.width * 100}%, 4px)`,
                  top: (lanes.laneOf.get(deadline.id) ?? 0) * LANE_HEIGHT + PADDING / 2,
                  height: BAR_HEIGHT,
                  ...chipStyle(category.colorToken)
                }}
              >
                <span aria-hidden="true" className="chip-tint absolute inset-0" />
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 bg-(--chip)/55"
                  style={{ width: `${layout.workFraction * 100}%` }}
                />
                {layout.nowFraction !== null && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 z-[1] w-0.5 bg-foreground/80"
                    style={{ left: `${layout.nowFraction * 100}%` }}
                  />
                )}
                <span className="relative z-[2] truncate px-1.5 text-[11px] leading-tight font-medium text-foreground/90">
                  {deadline.title}
                </span>
                <span className="tabular relative z-[2] truncate px-1.5 text-[10px] leading-tight text-foreground/70">
                  {format.formatDateTime(deadline.deadlineAt)} · {deadline.progress}% ·{' '}
                  {statusLabel}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <p className="px-1 text-[11px] text-muted-foreground">
        Bars run from tracking start to the deadline. The fill is work completed; the dark tick is
        today, so a tick past the fill means time is ahead of the work.
      </p>
    </div>
  )
}
