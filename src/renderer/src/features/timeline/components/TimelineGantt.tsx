import { CalendarClock } from 'lucide-react'
import { getCategory } from '@shared/constants/categories'
import { MILESTONE_STATUS_DEFINITIONS } from '@shared/constants/statuses'
import { compareInstants } from '@shared/dates'
import type { ConferenceDeadlineView } from '@shared/types/conference'
import { MILESTONE_CATEGORIES, type Milestone } from '@shared/types/milestone'
import type { PersonalDeadline } from '@shared/types/personalDeadline'
import { CategoryChip } from '@renderer/components/common/CategoryChip'
import { useFormat, type Formatters } from '@renderer/hooks/useFormat'
import { chipStyle, cn } from '@renderer/lib/utils'
import {
  axisTicks,
  barLayout,
  markerInBar,
  nowFractionInWindow,
  packLanes,
  packPointLanes,
  pointInWindow,
  type BarLayout,
  type GanttViewKind,
  type TimelineWindow
} from '../layout'

const LANE_HEIGHT = 44
const BAR_HEIGHT = 36
const TRACK_PADDING = 8
const CONFERENCE_LANE_HEIGHT = 26
/** Window fraction two conference labels need between them before sharing a lane. */
const CONFERENCE_LABEL_GAP = 0.14
const NO_CONFERENCES: ConferenceDeadlineView[] = []

export interface TimelineGanttProps {
  milestones: Milestone[]
  deadlines: PersonalDeadline[]
  /** Followed conferences only (spec §12.6); drawn as point markers in their own track. */
  conferences?: ConferenceDeadlineView[]
  nowIso: string
  view: GanttViewKind
  window: TimelineWindow
  /** Click a bar to edit it. */
  onEditMilestone?: (milestone: Milestone) => void
  /** Click a conference marker to open it on the Deadlines page. */
  onOpenConference?: (conference: ConferenceDeadlineView) => void
}

/**
 * The milestone Gantt (spec §15.1, §15.2). One track per category; inside a track, overlapping
 * milestones take separate lanes. Each bar spans start → target, is filled to its work progress,
 * carries a tick for today (time progress) and a marker per linked personal deadline, and turns
 * overdue-red once the target has passed without completion. Followed conference deadlines that
 * fall inside the window form a marker track above the categories. A global current-date line
 * runs through every track. Dates on the bars follow the user's `dateFormat`.
 */
export function TimelineGantt({
  milestones,
  deadlines,
  conferences = NO_CONFERENCES,
  nowIso,
  view,
  window,
  onEditMilestone,
  onOpenConference
}: TimelineGanttProps): React.JSX.Element {
  const format = useFormat()
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
  const tracks = MILESTONE_CATEGORIES.flatMap((category) => {
    const items = visible.filter((p) => p.milestone.category === category)
    if (items.length === 0) return []
    return [{ category, items, lanes: packLanes(items.map((p) => p.milestone)) }]
  })

  const conferenceMarkers = conferences.flatMap((item) => {
    if (!item.deadlineAt || item.status === 'tbd') return []
    const fraction = pointInWindow(item.deadlineAt, window)
    return fraction === null ? [] : [{ item, fraction }]
  })
  const conferenceLanes = packPointLanes(
    conferenceMarkers.map((m) => ({ id: m.item.id, fraction: m.fraction })),
    CONFERENCE_LABEL_GAP
  )

  const gridLines = (
    <>
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
    </>
  )

  return (
    <div className="flex flex-col gap-2">
      <div
        role="figure"
        aria-label="Milestone timeline"
        className="overflow-hidden rounded-lg border bg-card shadow-xs"
      >
        <div className="grid grid-cols-[8rem_minmax(0,1fr)] border-b border-border">
          <div className="px-3 py-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Category
          </div>
          <div className="relative h-7">
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
        </div>

        {conferenceMarkers.length > 0 && (
          <div
            className="grid grid-cols-[8rem_minmax(0,1fr)] border-b border-border"
            data-track="conferences"
          >
            <div className="flex items-start border-r border-border px-3 py-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                <CalendarClock className="size-3.5 text-status-on-track" aria-hidden="true" />
                Followed conferences
              </span>
            </div>
            <div
              className="relative"
              style={{ height: conferenceLanes.count * CONFERENCE_LANE_HEIGHT + TRACK_PADDING }}
            >
              {gridLines}
              {conferenceMarkers.map(({ item, fraction }) => {
                const lane = conferenceLanes.laneOf.get(item.id) ?? 0
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
                      'absolute z-[2] flex max-w-44 -translate-x-1/2 items-center gap-1 rounded-sm border border-status-on-track/40 bg-card px-1.5 text-[10px] leading-tight font-medium whitespace-nowrap shadow-xs outline-none hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring',
                      passed && 'opacity-60'
                    )}
                    style={{
                      left: `${Math.min(Math.max(fraction, 0.03), 0.97) * 100}%`,
                      top: lane * CONFERENCE_LANE_HEIGHT + TRACK_PADDING / 2,
                      height: CONFERENCE_LANE_HEIGHT - 6
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="size-2 shrink-0 rotate-45 rounded-[1px] bg-status-on-track"
                    />
                    <span className="truncate">{item.title}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {tracks.map(({ category, items, lanes }) => (
          <div
            key={category}
            className="grid grid-cols-[8rem_minmax(0,1fr)] border-b border-border last:border-b-0"
            data-track={category}
          >
            <div className="flex items-start border-r border-border px-3 py-2">
              <CategoryChip category={category} marker="icon" tinted />
            </div>
            <div className="relative" style={{ height: lanes.count * LANE_HEIGHT + TRACK_PADDING }}>
              {gridLines}
              {items.map(({ milestone, layout }) => (
                <MilestoneBar
                  key={milestone.id}
                  milestone={milestone}
                  layout={layout}
                  lane={lanes.laneOf.get(milestone.id) ?? 0}
                  linked={deadlines.filter((d) => d.linkedMilestoneId === milestone.id)}
                  nowIso={nowIso}
                  window={window}
                  format={format}
                  onClick={onEditMilestone ? () => onEditMilestone(milestone) : undefined}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <GanttLegend hidden={hidden} conferences={conferenceMarkers.length > 0} />
    </div>
  )
}

interface MilestoneBarProps {
  milestone: Milestone
  layout: BarLayout
  lane: number
  linked: PersonalDeadline[]
  nowIso: string
  window: TimelineWindow
  format: Formatters
  onClick?: () => void
}

function MilestoneBar({
  milestone,
  layout,
  lane,
  linked,
  nowIso,
  window,
  format,
  onClick
}: MilestoneBarProps): React.JSX.Element {
  const category = getCategory(milestone.category)
  const status = MILESTONE_STATUS_DEFINITIONS[milestone.status]
  const completed = milestone.status === 'completed'
  // Delayed state (spec §15.2): the target has passed without completion, or the user said so.
  const delayed =
    milestone.status === 'delayed' ||
    (!completed && compareInstants(milestone.targetAt, nowIso) < 0)
  const dates = `${format.formatDate(milestone.startAt)} → ${format.formatDate(milestone.targetAt)}`
  const linkedLabel =
    linked.length === 0
      ? ''
      : `, ${linked.length} linked ${linked.length === 1 ? 'deadline' : 'deadlines'}`

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${milestone.title} · ${dates} · ${milestone.progress}% done${delayed ? ' · past target' : ''}`}
      aria-label={`${milestone.title}, ${milestone.progress}% complete, ${status.label}${linkedLabel}`}
      data-milestone-id={milestone.id}
      data-delayed={delayed || undefined}
      className={cn(
        'absolute flex flex-col justify-center overflow-hidden border text-left transition-shadow outline-none hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring',
        layout.clippedStart ? 'rounded-l-none border-l-0' : 'rounded-l-md',
        layout.clippedEnd ? 'rounded-r-none border-r-0' : 'rounded-r-md',
        delayed ? 'border-status-overdue' : 'border-(--chip)/40',
        completed && 'opacity-75'
      )}
      style={{
        left: `${layout.left * 100}%`,
        width: `max(${layout.width * 100}%, 4px)`,
        top: lane * LANE_HEIGHT + TRACK_PADDING / 2,
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
      {linked.map((deadline) => {
        const marker = markerInBar(deadline.deadlineAt, layout, window)
        if (!marker) return null
        return (
          <span
            key={deadline.id}
            aria-hidden="true"
            title={`Deadline: ${deadline.title} · ${format.formatDateTimeWithZone(deadline.deadlineAt, deadline.timezone)}${marker.outside ? ' (outside this milestone)' : ''}`}
            className={cn(
              'absolute top-1/2 z-[2] size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1px] ring-1 ring-card',
              marker.outside ? 'border-2 border-status-urgent bg-card' : 'bg-status-urgent'
            )}
            style={{ left: `${marker.fraction * 100}%` }}
          />
        )
      })}
      <span className="relative z-[3] truncate px-1.5 text-[11px] leading-tight font-medium text-foreground/90">
        {milestone.title}
      </span>
      <span className="tabular relative z-[3] truncate px-1.5 text-[10px] leading-tight text-foreground/70">
        {dates} · {milestone.progress}%
      </span>
    </button>
  )
}

function GanttLegend({
  hidden,
  conferences
}: {
  hidden: number
  conferences: boolean
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="h-2.5 w-5 rounded-sm bg-primary/15 ring-1 ring-primary/30"
        />
        Scheduled span
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-2.5 w-5 rounded-sm bg-primary/55" />
        Work completed
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-3 w-0.5 bg-foreground/80" />
        Today (time elapsed)
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2 rotate-45 bg-status-urgent" />
        Linked deadline
      </span>
      {conferences && (
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rotate-45 bg-status-on-track" />
          Followed conference deadline
        </span>
      )}
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-2.5 w-5 rounded-sm border-2 border-status-overdue" />
        Past target, not complete
      </span>
      {hidden > 0 && (
        <span className="ml-auto" data-hidden-count={hidden}>
          {hidden} {hidden === 1 ? 'milestone falls' : 'milestones fall'} outside this range
        </span>
      )}
    </div>
  )
}
