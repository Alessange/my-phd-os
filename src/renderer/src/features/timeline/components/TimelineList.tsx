import { calculatePaceDifference, calculateTimeProgress, compareInstants } from '@shared/dates'
import type { Milestone } from '@shared/types/milestone'
import { CategoryChip } from '@renderer/components/common/CategoryChip'
import { describePace } from '@renderer/components/common/pace'
import { StatusBadge } from '@renderer/components/common/StatusBadge'
import { Progress } from '@renderer/components/ui/progress'
import { useFormat } from '@renderer/hooks/useFormat'

export interface TimelineListProps {
  milestones: Milestone[]
  nowIso: string
  onEditMilestone?: (milestone: Milestone) => void
}

/** Pace sentence for a milestone, or a state label when pace does not apply. */
const paceLabel = (m: Milestone, nowIso: string): string => {
  if (m.status === 'completed') return 'Completed'
  if (compareInstants(nowIso, m.startAt) < 0) return 'Not started yet'
  if (compareInstants(nowIso, m.targetAt) >= 0) return 'Past target'
  const time = calculateTimeProgress(m.startAt, m.targetAt, nowIso)
  return describePace(calculatePaceDifference(m.progress, time.clamped))
}

/**
 * Chronological list (spec §15.1): milestones sorted by start date with category, status, start and
 * target dates, the work-progress bar and a pace sentence. The title is a button that opens the editor.
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

  return (
    <div className="overflow-x-auto rounded-lg border bg-card shadow-xs">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted-foreground uppercase">
            <th className="px-3 py-2 font-medium">Milestone</th>
            <th className="px-3 py-2 font-medium">Category</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Start</th>
            <th className="px-3 py-2 font-medium">Target</th>
            <th className="px-3 py-2 font-medium">Work</th>
            <th className="px-3 py-2 font-medium">Pace</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr
              key={m.id}
              className="border-b border-border/60 last:border-b-0"
              data-milestone-id={m.id}
            >
              <td className="px-3 py-2 font-medium text-foreground/90">
                {onEditMilestone ? (
                  <button
                    type="button"
                    className="rounded-sm text-left outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => onEditMilestone(m)}
                  >
                    {m.title}
                  </button>
                ) : (
                  m.title
                )}
              </td>
              <td className="px-3 py-2">
                <CategoryChip category={m.category} marker="dot" />
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={m.status} size="sm" />
              </td>
              <td className="tabular px-3 py-2 text-muted-foreground">{formatDate(m.startAt)}</td>
              <td className="tabular px-3 py-2 text-muted-foreground">{formatDate(m.targetAt)}</td>
              <td className="w-44 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Progress
                    value={m.progress}
                    aria-label={`Work progress for ${m.title}`}
                    indicatorClassName="bg-progress-work"
                    size="sm"
                  />
                  <span className="tabular w-9 text-right text-xs text-muted-foreground">
                    {m.progress}%
                  </span>
                </div>
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{paceLabel(m, nowIso)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
