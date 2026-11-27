import { calculatePaceDifference, calculateTimeProgress, compareInstants } from '@shared/dates'
import type { Milestone } from '@shared/types/milestone'
import { CategoryChip } from '@renderer/components/common/CategoryChip'
import { describePace } from '@renderer/components/common/pace'
import { isAttentionStatus } from '@renderer/components/common/statusLookup'
import { StatusBadge } from '@renderer/components/common/StatusBadge'
import { Progress } from '@renderer/components/ui/progress'
import { useFormat } from '@renderer/hooks/useFormat'

export interface TimelineListProps {
  milestones: Milestone[]
  nowIso: string
  onEditMilestone?: (milestone: Milestone) => void
}

/** A pace gap smaller than this many points is not worth a sentence. */
const NOTABLE_PACE_POINTS = 10

/**
 * What is worth saying about a milestone's pace, or null. Completed and not-yet-started milestones
 * say it with their status; a past-target milestone marked Delayed says it there too.
 */
const paceNote = (m: Milestone, nowIso: string): string | null => {
  if (m.status === 'completed') return null
  if (compareInstants(nowIso, m.startAt) < 0) return null
  if (compareInstants(nowIso, m.targetAt) >= 0) return m.status === 'delayed' ? null : 'Past target'
  const time = calculateTimeProgress(m.startAt, m.targetAt, nowIso)
  const gap = calculatePaceDifference(m.progress, time.clamped)
  return Math.abs(gap) >= NOTABLE_PACE_POINTS ? describePace(gap) : null
}

/**
 * Chronological list (spec §15.1): milestones sorted by start date with category, status, the span,
 * a 2 px work line with its value, and the pace when it is notable. Hairline rows on the page
 * ground, one ink rule under the head, no scroller of its own. The title is a button that opens
 * the editor.
 */
export function TimelineList({
  milestones,
  nowIso,
  onEditMilestone
}: TimelineListProps): React.JSX.Element {
  const { formatDate } = useFormat()
  const rows = [...milestones].sort(
    (a, b) => compareInstants(a.startAt, b.startAt) || a.title.localeCompare(b.title)
  )

  const showPace = rows.some((m) => paceNote(m, nowIso) !== null)

  return (
    <table className="w-full border-collapse text-body">
      <thead>
        <tr className="border-b border-ink text-left text-meta text-ink-3">
          <th className="py-2 pr-4 font-normal">Milestone</th>
          <th className="px-4 py-2 font-normal">Category</th>
          <th className="px-4 py-2 font-normal">Status</th>
          <th className="px-4 py-2 font-normal">Dates</th>
          <th className="px-4 py-2 font-normal">Work</th>
          {showPace && <th className="py-2 pl-4 font-normal">Pace</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((m) => {
          const note = paceNote(m, nowIso)
          return (
            <tr key={m.id} className="border-b border-line" data-milestone-id={m.id}>
              <td className="py-3.5 pr-4 text-ink">
                {onEditMilestone ? (
                  <button
                    type="button"
                    className="hit-28 text-left hover:underline hover:underline-offset-4"
                    onClick={() => onEditMilestone(m)}
                  >
                    {m.title}
                  </button>
                ) : (
                  m.title
                )}
              </td>
              <td className="px-4 py-3.5">
                <CategoryChip category={m.category} className="text-body" />
              </td>
              <td className="px-4 py-3.5 whitespace-nowrap">
                {/* Fixed 22 px line: a glyph in the mark must not make this row taller than the others. */}
                <div className="flex h-[22px] items-center">
                  <StatusBadge status={m.status} hideIcon={!isAttentionStatus(m.status)} />
                </div>
              </td>
              <td className="tabular px-4 py-3.5 whitespace-nowrap text-ink-2">
                {formatDate(m.startAt)} – {formatDate(m.targetAt)}
              </td>
              <td className="w-44 px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <Progress value={m.progress} aria-label={`Work progress for ${m.title}`} />
                  <span className="tabular w-10 shrink-0 text-right text-meta text-ink-2">
                    {m.progress}%
                  </span>
                </div>
              </td>
              {showPace && <td className="py-3.5 pl-4 text-meta text-ink-3">{note}</td>}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
