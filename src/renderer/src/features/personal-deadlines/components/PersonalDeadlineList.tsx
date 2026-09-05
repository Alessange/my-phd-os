import { PRIORITY_DEFINITIONS } from '@shared/constants/statuses'
import type { DescribedDeadline } from '@shared/personal-deadlines/views'
import type { PersonalDeadline } from '@shared/types/personalDeadline'
import { CategoryChip } from '@renderer/components/common/CategoryChip'
import { Countdown } from '@renderer/components/common/Countdown'
import { StatusBadge } from '@renderer/components/common/StatusBadge'
import { Progress } from '@renderer/components/ui/progress'
import { useFormat } from '@renderer/hooks/useFormat'
import { clampPercent } from '@renderer/lib/utils'

export interface PersonalDeadlineListProps {
  items: DescribedDeadline[]
  onOpen: (deadline: PersonalDeadline) => void
}

/** Compact list (spec §13.3): one row per deadline with both progress figures kept separate. */
export function PersonalDeadlineList({
  items,
  onOpen
}: PersonalDeadlineListProps): React.JSX.Element {
  const format = useFormat()
  return (
    <div className="overflow-x-auto rounded-lg border bg-card shadow-xs">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted-foreground uppercase">
            <th className="px-3 py-2 font-medium">Deadline</th>
            <th className="px-3 py-2 font-medium">Category</th>
            <th className="px-3 py-2 font-medium">Priority</th>
            <th className="px-3 py-2 font-medium">Due</th>
            <th className="px-3 py-2 font-medium">Remaining</th>
            <th className="px-3 py-2 font-medium">Time</th>
            <th className="px-3 py-2 font-medium">Work</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map(({ deadline, computed }) => (
            <tr
              key={deadline.id}
              className="border-b border-border/60 last:border-b-0"
              data-deadline-id={deadline.id}
            >
              <td className="px-3 py-2 font-medium text-foreground/90">
                <button
                  type="button"
                  className="rounded-sm text-left outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onOpen(deadline)}
                >
                  {deadline.title}
                </button>
              </td>
              <td className="px-3 py-2">
                <CategoryChip category={deadline.category} marker="dot" />
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={PRIORITY_DEFINITIONS[deadline.priority]} size="sm" />
              </td>
              <td className="tabular px-3 py-2 text-muted-foreground">
                <div>{format.formatDateTimeWithZone(deadline.deadlineAt, deadline.timezone)}</div>
                <div className="text-[11px]">
                  Local: {format.formatDateTime(deadline.deadlineAt)}
                </div>
              </td>
              <td className="tabular px-3 py-2">
                <Countdown targetIso={deadline.deadlineAt} variant="inline" />
              </td>
              <td className="w-32 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Progress
                    value={computed.timeProgress.clamped * 100}
                    aria-label={`Time elapsed for ${deadline.title}`}
                    indicatorClassName="bg-progress-time"
                    size="sm"
                  />
                  <span className="tabular w-9 text-right text-xs text-muted-foreground">
                    {clampPercent(computed.timeProgress.clamped * 100)}%
                  </span>
                </div>
              </td>
              <td className="w-32 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Progress
                    value={deadline.progress}
                    aria-label={`Work completed for ${deadline.title}`}
                    indicatorClassName="bg-progress-work"
                    size="sm"
                  />
                  <span className="tabular w-9 text-right text-xs text-muted-foreground">
                    {deadline.progress}%
                  </span>
                </div>
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={computed.status} size="sm" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
