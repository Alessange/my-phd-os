import { DEADLINE_STATUS_DEFINITIONS } from '@shared/constants/statuses'
import type { DescribedDeadline } from '@shared/personal-deadlines/views'
import type { PersonalDeadline } from '@shared/types/personalDeadline'
import { StatusBadge } from '@renderer/components/common/StatusBadge'
import {
  axisTicks,
  barLayout,
  extentWindow,
  nowFractionInWindow,
  type TimeSpan
} from '@renderer/features/timeline/layout'
import { useFormat } from '@renderer/hooks/useFormat'
import { cn } from '@renderer/lib/utils'

const DAY_MS = 24 * 60 * 60 * 1000
/** Fixed columns around the plot: title rail on the left, status word on the right. */
const COLUMNS = '224px minmax(0,1fr) 120px'
const ROW_HEIGHT = 56

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
 * Timeline view (spec §13.3, DESIGN.md section 9): one row per deadline. The outlined bar is the
 * tracking window (start to deadline), the ink fill is the work done, the value is printed at the
 * bar's end and the single 1 px ink line is today. Reuses the milestone layout maths so both
 * timelines read the same way. The row is the control: title rail, bar and status word.
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
  const ticks = axisTicks(window, view, format.zone, format.settings.weekStartsOn).filter(
    (t) => t.major
  )
  const nowFrac = nowFractionInWindow(nowIso, window)
  const pct = (ms: number): string =>
    `${((ms - window.startMs) / (window.endMs - window.startMs)) * 100}%`

  return (
    <div className="flex flex-col gap-4">
      <div role="figure" aria-label="Deadline timeline" className="relative">
        {/* The plot columns: month lines and the one now line, behind the rows. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-[120px] left-[224px]"
        >
          {ticks.map((t) => (
            <span
              key={t.ms}
              className="absolute inset-y-0 w-px bg-line"
              style={{ left: pct(t.ms) }}
            />
          ))}
          {nowFrac !== null && (
            <span
              className="absolute inset-y-0 w-px bg-ink"
              style={{ left: `${nowFrac * 100}%` }}
            />
          )}
        </div>

        <div
          className="grid h-9 items-end border-b border-line"
          style={{ gridTemplateColumns: COLUMNS }}
        >
          <span />
          <span className="relative block h-full">
            {ticks.map((t, index) => (
              <span
                key={t.ms}
                className={cn(
                  'text-meta absolute bottom-1.5 whitespace-nowrap pl-1.5 text-ink-3',
                  index % 2 === 1 && 'max-[1099px]:hidden'
                )}
                style={{ left: pct(t.ms) }}
              >
                {index === 0 || t.label.startsWith('Jan') ? t.label : t.label.split(' ')[0]}
              </span>
            ))}
            {nowFrac !== null && (
              <span
                className="text-meta absolute bottom-1.5 -translate-x-1/2 bg-background px-1.5 text-ink"
                style={{ left: `${nowFrac * 100}%` }}
              >
                Today
              </span>
            )}
          </span>
          <span />
        </div>

        <ul className="relative">
          {items.map(({ deadline, computed }, index) => {
            const layout = barLayout(toSpan(deadline), window, nowIso)
            const statusLabel = DEADLINE_STATUS_DEFINITIONS[computed.status].label
            const right = layout.left + layout.width
            const valueLeft = right > 0.88
            return (
              <li
                key={deadline.id}
                className={cn(index < items.length - 1 && 'border-b border-line')}
              >
                <button
                  type="button"
                  onClick={() => onOpen(deadline)}
                  aria-label={`${deadline.title}, ${deadline.progress}% complete, ${statusLabel}`}
                  title={`${deadline.title} · due ${format.formatDateTimeWithZone(deadline.deadlineAt, deadline.timezone)} · ${deadline.progress}% done`}
                  data-deadline-id={deadline.id}
                  className="grid w-full items-center text-left outline-offset-[-2px]"
                  style={{ gridTemplateColumns: COLUMNS, height: ROW_HEIGHT }}
                >
                  <span className="flex min-w-0 flex-col pr-4">
                    <span className="text-body truncate text-ink">{deadline.title}</span>
                    <span className="text-meta tabular truncate text-ink-3">
                      {format.formatDateTimeWithZone(deadline.deadlineAt, deadline.timezone)}
                    </span>
                  </span>
                  <span className="relative block h-full">
                    {layout.inWindow && (
                      <>
                        <span
                          aria-hidden="true"
                          className="absolute top-1/2 block h-3 -translate-y-1/2 overflow-hidden rounded-xs border border-edge"
                          style={{
                            left: `${layout.left * 100}%`,
                            width: `max(${layout.width * 100}%, 6px)`
                          }}
                        >
                          <span
                            className="block h-full bg-ink"
                            style={{ width: `${layout.workFraction * 100}%` }}
                          />
                        </span>
                        <span
                          aria-hidden="true"
                          className={cn(
                            'text-meta tabular absolute top-1/2 -translate-y-1/2 whitespace-nowrap bg-background px-1 text-ink-3',
                            valueLeft && '-translate-x-full'
                          )}
                          style={{
                            left: valueLeft
                              ? `calc(${layout.left * 100}% - 6px)`
                              : `calc(${right * 100}% + 6px)`
                          }}
                        >
                          {deadline.progress}%
                        </span>
                      </>
                    )}
                  </span>
                  <span className="flex justify-end">
                    <StatusBadge status={computed.status} size="md" attentionGlyphOnly />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
      <p className="text-meta text-ink-3">
        Outline is the plan, fill is the work done, the line is today.
      </p>
    </div>
  )
}
