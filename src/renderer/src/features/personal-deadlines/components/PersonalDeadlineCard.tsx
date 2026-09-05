import { CalendarCheck, ExternalLink, Milestone as MilestoneIcon } from 'lucide-react'
import { PRIORITY_DEFINITIONS } from '@shared/constants/statuses'
import type { DescribedDeadline } from '@shared/personal-deadlines/views'
import type { PersonalDeadline } from '@shared/types/personalDeadline'
import { CategoryChip } from '@renderer/components/common/CategoryChip'
import { Countdown } from '@renderer/components/common/Countdown'
import { DualProgress } from '@renderer/components/common/DualProgress'
import { StatusBadge } from '@renderer/components/common/StatusBadge'
import { ZonedTime } from '@renderer/components/common/ZonedTime'
import { Badge } from '@renderer/components/ui/badge'

export interface PersonalDeadlineCardProps {
  item: DescribedDeadline
  onOpen: (deadline: PersonalDeadline) => void
}

/**
 * Visual card (spec §13.2): title, category, priority, computed status, the deadline in its own
 * zone and in local time, the exact remaining time, and the two separate progress bars with the
 * pace sentence. The title opens the details drawer.
 */
export function PersonalDeadlineCard({
  item,
  onOpen
}: PersonalDeadlineCardProps): React.JSX.Element {
  const { deadline, computed } = item
  const tags = deadline.tags ?? []
  return (
    <article
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-xs"
      data-deadline-id={deadline.id}
      data-status={computed.status}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">
            <button
              type="button"
              onClick={() => onOpen(deadline)}
              className="rounded-sm text-left outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {deadline.title}
            </button>
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <CategoryChip category={deadline.category} marker="dot" />
            <StatusBadge status={PRIORITY_DEFINITIONS[deadline.priority]} size="sm" />
            {tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">
                #{tag}
              </Badge>
            ))}
          </div>
        </div>
        <StatusBadge status={computed.status} size="sm" />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <ZonedTime
          instantIso={deadline.deadlineAt}
          originalZone={deadline.timezone}
          layout="stacked"
          className="text-xs"
        />
        <div className="text-right">
          <div className="text-[10px] tracking-wide text-muted-foreground uppercase">
            {computed.remaining.isPast ? 'Overdue by' : 'Remaining'}
          </div>
          <Countdown
            targetIso={deadline.deadlineAt}
            variant="inline"
            className="text-sm font-semibold"
          />
        </div>
      </div>

      <DualProgress
        timePercent={computed.timeProgress.clamped * 100}
        workPercent={deadline.progress}
        paceDifference={computed.paceDifference}
      />

      {(deadline.sourceUrl || deadline.linkedMilestoneId || deadline.linkedCalendarEventId) && (
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          {deadline.sourceUrl && (
            <a
              href={deadline.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:underline"
            >
              <ExternalLink className="size-3" aria-hidden="true" />
              Source
            </a>
          )}
          {deadline.linkedMilestoneId && (
            <span className="inline-flex items-center gap-1">
              <MilestoneIcon className="size-3" aria-hidden="true" />
              Linked milestone
            </span>
          )}
          {deadline.linkedCalendarEventId && (
            <span className="inline-flex items-center gap-1">
              <CalendarCheck className="size-3" aria-hidden="true" />
              On calendar
            </span>
          )}
        </div>
      )}
    </article>
  )
}
