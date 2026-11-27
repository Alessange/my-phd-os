import { Check, ChevronLeft, ChevronRight, CircleAlert } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { getCategory } from '@shared/constants/categories'
import { MILESTONE_STATUS_DEFINITIONS } from '@shared/constants/statuses'
import { compareInstants } from '@shared/dates'
import type { ConferenceDeadlineView } from '@shared/types/conference'
import { MILESTONE_CATEGORIES, type Milestone } from '@shared/types/milestone'
import type { PersonalDeadline } from '@shared/types/personalDeadline'
import { useFormat, type Formatters } from '@renderer/hooks/useFormat'
import { cn } from '@renderer/lib/utils'
import {
  axisTicks,
  barLabelSide,
  barLayout,
  daysPastTarget,
  markerInBar,
  nowFractionInWindow,
  pointInWindow,
  type BarLayout,
  type GanttViewKind,
  type TimelineWindow
} from '../layout'

/** Rail (labels) and plot share one grid so every row, the axis and the grid lines line up. */
const RAIL_GRID =
  'grid grid-cols-[280px_minmax(0,1fr)] min-[1100px]:grid-cols-[304px_minmax(0,1fr)]'
/** Rows breathe at 68 px; a long list tightens to 54 px so the chart stays within a screen or so. */
const ROOMY_ROW_HEIGHT = 68
const COMPACT_ROW_HEIGHT = 54
const ROOMY_ROW_COUNT = 6
const BAR_HIT_HEIGHT = 28
const CONFERENCE_LANE_HEIGHT = 28
const CONFERENCE_PAD = 5
/** Labelled lanes in the conference strip; markers that fit in neither keep their diamond but lose the name. */
const CONFERENCE_MAX_LANES = 2
/** Height of the extra row of nameless diamonds (only when a dense window needs it). */
const CONFERENCE_OVERFLOW_HEIGHT = 22
/** Horizontal space around a conference name in the strip: diamond, gaps and breathing room. */
const CONFERENCE_LABEL_CHROME = 41
const CONFERENCE_CHAR_WIDTH = 7.8
const CONFERENCE_LABEL_GAP = 4
/** Conference labels flip to the left of their diamond past this window fraction. */
const CONFERENCE_FLIP_FRACTION = 0.86
/** Plot width assumed until the first measurement (1440 px window). */
const FALLBACK_PLOT_WIDTH = 792
/** Hide a year label closer than this window fraction to the Today label. */
const TODAY_CLEARANCE = 0.07
const NO_CONFERENCES: ConferenceDeadlineView[] = []

export interface TimelineGanttProps {
  milestones: Milestone[]
  deadlines: PersonalDeadline[]
  /** Followed conferences only (spec §12.6); drawn as point markers in their own row. */
  conferences?: ConferenceDeadlineView[]
  nowIso: string
  view: GanttViewKind
  window: TimelineWindow
  /** The range label and previous / next controls, placed top-left of the chart. */
  toolbar?: ReactNode
  /** Click a bar to edit it. */
  onEditMilestone?: (milestone: Milestone) => void
  /** Click a conference marker to open it on the Deadlines page. */
  onOpenConference?: (conference: ConferenceDeadlineView) => void
  /** Offered in the footer when milestones fall outside the window. */
  onShowMultiYear?: () => void
}

/** `CVPR 2027 Deadline` reads as `CVPR`: the axis already says the year, the row says deadline. */
const shortConferenceName = (title: string): string =>
  title
    .replace(/\s+deadline$/i, '')
    .replace(/\s+(?:19|20)\d{2}$/, '')
    .trim() || title

/**
 * The milestone Gantt (spec §15.1, §15.2), drawn as a printed page: one row per milestone, grouped
 * by category (the label sits on the first row of a group, in small caps). The outline of a bar is
 * the plan (start to target), the ink fill is the work done, and no text is printed inside a bar:
 * the value (`40%`, `Past target by 10 days`) sits beside it. One 1 px ink line marks today. A bar
 * cut by the window loses its outline on that side and gets a `‹` / `›` cue. Followed conference
 * deadlines inside the window are diamonds in a strip above the rows.
 */
export function TimelineGantt({
  milestones,
  deadlines,
  conferences = NO_CONFERENCES,
  nowIso,
  view,
  window,
  toolbar,
  onEditMilestone,
  onOpenConference,
  onShowMultiYear
}: TimelineGanttProps): React.JSX.Element {
  const format = useFormat()
  const [plotEl, setPlotEl] = useState<HTMLElement | null>(null)
  const [plotWidth, setPlotWidth] = useState(0)
  useEffect(() => {
    if (!plotEl) return
    const measure = (): void => setPlotWidth(plotEl.clientWidth)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(plotEl)
    return () => observer.disconnect()
  }, [plotEl])

  const ticks = axisTicks(window, view, format.zone, format.settings.weekStartsOn)
  const nowFrac = nowFractionInWindow(nowIso, window)
  const span = window.endMs - window.startMs
  const pct = (ms: number): string => `${((ms - window.startMs) / span) * 100}%`

  const placed = milestones.map((milestone) => ({
    milestone,
    layout: barLayout(milestone, window, nowIso)
  }))
  const visible = placed.filter((p) => p.layout.inWindow)
  const hidden = placed.length - visible.length
  const rows = MILESTONE_CATEGORIES.flatMap((category) =>
    visible
      .filter((p) => p.milestone.category === category)
      .sort(
        (a, b) =>
          compareInstants(a.milestone.startAt, b.milestone.startAt) ||
          a.milestone.title.localeCompare(b.milestone.title)
      )
      .map((p, index) => ({ ...p, first: index === 0 }))
  )

  const conferenceMarkers = conferences.flatMap((item) => {
    if (!item.deadlineAt || item.status === 'tbd') return []
    const fraction = pointInWindow(item.deadlineAt, window)
    return fraction === null ? [] : [{ item, fraction, name: shortConferenceName(item.title) }]
  })
  // Greedy lane assignment in pixels: a marker takes the first lane whose last name has ended;
  // one that fits none keeps its diamond (name in the tooltip and accessible name) in an extra row.
  const width = plotWidth || FALLBACK_PLOT_WIDTH
  const laneEnds: number[] = []
  const laneOf = new Map<string, number>()
  for (const m of [...conferenceMarkers].sort((a, b) => a.fraction - b.fraction)) {
    const labelWidth = m.name.length * CONFERENCE_CHAR_WIDTH + CONFERENCE_LABEL_CHROME
    const x = m.fraction * width
    const flipped = m.fraction > CONFERENCE_FLIP_FRACTION
    const from = flipped ? x - labelWidth + 17 : x - 8.5
    const to = from + labelWidth
    const lane = laneEnds.findIndex((end, index) => index < CONFERENCE_MAX_LANES && from >= end)
    if (lane !== -1) {
      laneEnds[lane] = to + CONFERENCE_LABEL_GAP
      laneOf.set(m.item.id, lane)
    } else if (laneEnds.length < CONFERENCE_MAX_LANES) {
      laneEnds.push(to + CONFERENCE_LABEL_GAP)
      laneOf.set(m.item.id, laneEnds.length - 1)
    } else {
      laneOf.set(m.item.id, CONFERENCE_MAX_LANES)
    }
  }
  const conferenceLaneCount = Math.max(1, laneEnds.length)
  const conferenceOverflow = conferenceMarkers.some(
    (m) => laneOf.get(m.item.id) === CONFERENCE_MAX_LANES
  )
  const conferenceHeight =
    conferenceLaneCount * CONFERENCE_LANE_HEIGHT +
    (conferenceOverflow ? CONFERENCE_OVERFLOW_HEIGHT : 0) +
    2 * CONFERENCE_PAD
  const rowHeight = rows.length > ROOMY_ROW_COUNT ? COMPACT_ROW_HEIGHT : ROOMY_ROW_HEIGHT

  // Axis labels: months on the lower line (the whole label for multi-year years), the year above
  // the first month and every January, `Today` above its line.
  const labelled = ticks
    .filter((t) => t.major)
    .map((t) => {
      const [month = '', year = ''] = t.label.split(' ')
      const fraction = (t.ms - window.startMs) / span
      return { ms: t.ms, fraction, text: view === 'multiYear' ? t.label : month, year }
    })
  const yearLabels =
    view === 'multiYear'
      ? []
      : labelled
          .filter((t, index) => index === 0 || t.text === 'Jan')
          .filter((t) => nowFrac === null || Math.abs(t.fraction - nowFrac) > TODAY_CLEARANCE)

  return (
    <div className="flex flex-col gap-3">
      <div role="figure" aria-label="Milestone timeline">
        <div className={cn(RAIL_GRID, 'h-[52px] items-end border-b border-ink')}>
          <div className="flex flex-wrap items-center gap-x-2 pr-4 pb-1.5">{toolbar}</div>
          <div ref={setPlotEl} className="relative h-full" data-slot="timeline-axis">
            {yearLabels.map((t) => (
              <span
                key={`y${t.ms}`}
                aria-hidden="true"
                className="absolute top-0.5 pl-1 text-meta whitespace-nowrap text-ink-3"
                style={{ left: `${t.fraction * 100}%` }}
              >
                {t.year}
              </span>
            ))}
            {labelled.map((t) => (
              <span
                key={t.ms}
                className="absolute top-6 pl-1 text-meta whitespace-nowrap text-ink-3"
                style={{ left: `${t.fraction * 100}%` }}
              >
                {t.text}
              </span>
            ))}
            {nowFrac !== null && (
              <>
                <span
                  className="absolute top-0.5 -translate-x-1/2 text-meta whitespace-nowrap text-ink"
                  style={{ left: `${nowFrac * 100}%` }}
                >
                  Today
                </span>
                <span
                  aria-hidden="true"
                  className="absolute top-[22px] bottom-0 z-[2] w-px bg-ink"
                  style={{ left: `${nowFrac * 100}%` }}
                />
              </>
            )}
          </div>
        </div>

        <div className="relative">
          <div className={cn(RAIL_GRID, 'pointer-events-none absolute inset-0')} aria-hidden="true">
            <div />
            <div className="relative">
              {ticks.map((t) => (
                <span
                  key={`${t.major ? 'M' : 'm'}${t.ms}`}
                  className={cn('absolute inset-y-0 w-px', t.major ? 'bg-line' : 'bg-line/50')}
                  style={{ left: pct(t.ms) }}
                />
              ))}
              {nowFrac !== null && (
                <span
                  className="absolute inset-y-0 z-[2] w-px bg-ink"
                  style={{ left: `${nowFrac * 100}%` }}
                />
              )}
            </div>
          </div>

          {conferenceMarkers.length > 0 && (
            <div className={cn(RAIL_GRID, 'border-b border-line')} data-track="conferences">
              <div className="pt-3.5 pr-4">
                <span className="small-caps">Followed conferences</span>
              </div>
              <div className="relative" style={{ height: conferenceHeight }}>
                {conferenceMarkers.map(({ item, fraction, name }) => {
                  const lane = laneOf.get(item.id) ?? 0
                  const labelled = lane < CONFERENCE_MAX_LANES
                  const flip = fraction > CONFERENCE_FLIP_FRACTION
                  const when = format.formatDateTimeWithZone(item.deadlineAt ?? nowIso)
                  const passed = item.status === 'passed'
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={onOpenConference ? () => onOpenConference(item) : undefined}
                      title={`${item.title} · ${when}${passed ? ' · passed' : ''}`}
                      aria-label={`Conference deadline: ${item.title}, ${when}${passed ? ', passed' : ''}`}
                      data-conference-id={item.id}
                      className={cn(
                        'absolute z-[3] flex items-center gap-2 px-1 text-meta whitespace-nowrap',
                        labelled ? 'h-7' : 'h-[22px]',
                        flip && 'flex-row-reverse',
                        passed ? 'text-ink-3' : 'text-ink-2'
                      )}
                      style={{
                        left: `${fraction * 100}%`,
                        top: labelled
                          ? lane * CONFERENCE_LANE_HEIGHT + CONFERENCE_PAD
                          : conferenceLaneCount * CONFERENCE_LANE_HEIGHT + CONFERENCE_PAD,
                        transform: flip ? 'translateX(calc(-100% + 8.5px))' : 'translateX(-8.5px)'
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'size-[9px] shrink-0 rotate-45',
                          passed ? 'border border-ink-3' : 'bg-ink'
                        )}
                      />
                      {labelled && <span className="bg-paper px-0.5">{name}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div role="list">
            {rows.map(({ milestone, layout, first }) => (
              <MilestoneRow
                key={milestone.id}
                milestone={milestone}
                layout={layout}
                first={first}
                linked={deadlines.filter((d) => d.linkedMilestoneId === milestone.id)}
                nowIso={nowIso}
                window={window}
                format={format}
                rowHeight={rowHeight}
                onClick={onEditMilestone ? () => onEditMilestone(milestone) : undefined}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1 text-meta text-ink-3">
        <p data-hidden-count={hidden > 0 ? hidden : undefined}>
          {hidden > 0 && (
            <>
              {hidden} {hidden === 1 ? 'milestone falls' : 'milestones fall'} outside this range.{' '}
              {view !== 'multiYear' && onShowMultiYear && (
                <button type="button" className="link-quiet" onClick={onShowMultiYear}>
                  Show multi-year
                </button>
              )}
            </>
          )}
        </p>
        <p>Outline is the plan, fill is the work done, the line is today.</p>
      </div>
    </div>
  )
}

interface MilestoneRowProps {
  milestone: Milestone
  layout: BarLayout
  /** First row of its category: carries the small-caps category label. */
  first: boolean
  linked: PersonalDeadline[]
  nowIso: string
  window: TimelineWindow
  format: Formatters
  rowHeight: number
  onClick?: () => void
}

function MilestoneRow({
  milestone,
  layout,
  first,
  linked,
  nowIso,
  window,
  format,
  rowHeight,
  onClick
}: MilestoneRowProps): React.JSX.Element {
  const category = getCategory(milestone.category)
  const status = MILESTONE_STATUS_DEFINITIONS[milestone.status]
  const completed = milestone.status === 'completed'
  // Delayed state (spec §15.2): the target has passed without completion, or the user said so.
  const pastTarget = !completed && compareInstants(milestone.targetAt, nowIso) < 0
  const delayed = milestone.status === 'delayed' || pastTarget
  const late = daysPastTarget(milestone.targetAt, nowIso)
  const note = !delayed
    ? null
    : pastTarget && late > 0
      ? `Past target by ${late} ${late === 1 ? 'day' : 'days'}`
      : pastTarget
        ? 'Past target'
        : 'Delayed'
  const dates = `${format.formatDate(milestone.startAt)} – ${format.formatDate(milestone.targetAt)}`
  const linkedLabel =
    linked.length === 0
      ? ''
      : `, ${linked.length} linked ${linked.length === 1 ? 'deadline' : 'deadlines'}`

  const side = barLabelSide(layout)
  const end = (layout.left + layout.width) * 100
  const center = rowHeight / 2
  const labelStyle: React.CSSProperties =
    side === 'right'
      ? { left: `calc(${end}% + 4px)`, top: center - 10 }
      : side === 'left'
        ? { right: `calc(${(1 - layout.left) * 100}% + 4px)`, top: center - 10 }
        : { left: 0, top: center + 6 }

  return (
    <div
      role="listitem"
      className={cn(RAIL_GRID, 'border-b border-line')}
      style={{ height: rowHeight }}
      data-milestone-row={milestone.id}
    >
      <div className="grid grid-cols-[108px_minmax(0,1fr)] items-center pr-3 min-[1100px]:grid-cols-[112px_minmax(0,1fr)]">
        <span className="small-caps self-start pt-3.5 leading-snug">{first && category.label}</span>
        <div className="min-w-0">
          <p className="truncate text-body text-ink" title={milestone.title}>
            {milestone.title}
          </p>
          <p className="text-meta text-ink-3">{dates}</p>
        </div>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={onClick}
          title={`${milestone.title} · ${dates} · ${milestone.progress}% done${delayed ? ' · past target' : ''}`}
          aria-label={`${milestone.title}, ${milestone.progress}% complete, ${status.label}${linkedLabel}, ${dates}`}
          data-milestone-id={milestone.id}
          data-delayed={delayed || undefined}
          className="absolute z-[1]"
          style={{
            left: `${layout.left * 100}%`,
            width: `max(${layout.width * 100}%, 6px)`,
            top: center - BAR_HIT_HEIGHT / 2,
            height: BAR_HIT_HEIGHT
          }}
        >
          <span
            aria-hidden="true"
            className={cn(
              'absolute inset-x-0 top-2 h-3 overflow-hidden rounded-xs border border-edge',
              layout.clippedStart && 'rounded-l-none border-l-transparent',
              layout.clippedEnd && 'rounded-r-none border-r-transparent'
            )}
          >
            <span
              className="absolute inset-y-0 left-0 bg-ink"
              style={{ width: `${(completed ? 1 : layout.workFraction) * 100}%` }}
            />
          </span>
          {linked.map((deadline) => {
            const marker = markerInBar(deadline.deadlineAt, layout, window)
            if (!marker) return null
            return (
              <span
                key={deadline.id}
                aria-hidden="true"
                title={`Deadline: ${deadline.title} · ${format.formatDateTimeWithZone(deadline.deadlineAt, deadline.timezone)}${marker.outside ? ' (outside this milestone)' : ''}`}
                className={cn(
                  'absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border bg-paper',
                  marker.outside ? 'border-ink-3' : 'border-ink'
                )}
                style={{ left: `${marker.fraction * 100}%` }}
              />
            )
          })}
        </button>

        {layout.clippedStart && (
          <ChevronLeft
            aria-hidden="true"
            className="absolute size-4 text-ink-3"
            style={{ left: -18, top: center - 8 }}
          />
        )}
        {layout.clippedEnd && (
          <ChevronRight
            aria-hidden="true"
            className="absolute size-4 text-ink-3"
            style={{ left: 'calc(100% + 4px)', top: center - 8 }}
          />
        )}

        <span
          className={cn(
            'absolute z-[3] flex items-center gap-3 bg-paper px-1.5 text-meta whitespace-nowrap text-ink-2',
            side === 'left' && 'flex-row-reverse'
          )}
          style={labelStyle}
        >
          {completed ? (
            <span className="inline-flex items-center gap-1.5 text-ink-3">
              <Check aria-hidden="true" className="size-3.5" />
              Completed
            </span>
          ) : (
            <span className="tabular">{milestone.progress}%</span>
          )}
          {note && (
            <span className="inline-flex items-center gap-1.5 text-signal">
              <CircleAlert aria-hidden="true" className="size-3.5" />
              {note}
            </span>
          )}
        </span>
      </div>
    </div>
  )
}
