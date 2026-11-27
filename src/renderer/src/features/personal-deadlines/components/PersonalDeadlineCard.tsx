import type { DescribedDeadline } from '@shared/personal-deadlines/views'
import type { PersonalDeadline } from '@shared/types/personalDeadline'
import { DualProgress } from '@renderer/components/common/DualProgress'
import { StatusBadge } from '@renderer/components/common/StatusBadge'
import { ZonedTime } from '@renderer/components/common/ZonedTime'
import { DeadlineCountdown } from '@renderer/features/conference-deadlines/components/DeadlineCountdown'
import { DeadlineMeta } from './DeadlineMeta'

export interface PersonalDeadlineCardProps {
  item: DescribedDeadline
  onOpen: (deadline: PersonalDeadline) => void
}

/** The pace sentence is worth a line only when the gap is clearly one way or the other. */
const NOTABLE_PACE = 20

/**
 * One block of the Cards view (spec §13.2, DESIGN.md 8.2): title, category line, due date, the exact
 * remaining time at 28 px, the two separate bars, the status word. No border and no fill; the
 * grid gives the blocks a hairline and whitespace. The title opens the details drawer.
 */
export function PersonalDeadlineCard({
  item,
  onOpen
}: PersonalDeadlineCardProps): React.JSX.Element {
  const { deadline, computed } = item
  const links = [
    deadline.sourceUrl && (
      <a
        key="source"
        href={deadline.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="link-quiet"
      >
        Source
      </a>
    ),
    deadline.linkedMilestoneId && <span key="milestone">Linked milestone</span>,
    deadline.linkedCalendarEventId && <span key="calendar">On calendar</span>
  ].filter(Boolean)
  return (
    <article
      className="flex h-full flex-col gap-5 border-b border-line py-6"
      data-deadline-id={deadline.id}
      data-status={computed.status}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-lead">
            <button
              type="button"
              onClick={() => onOpen(deadline)}
              className="line-clamp-2 text-left outline-offset-4 hover:underline"
              title={deadline.title}
            >
              {deadline.title}
            </button>
          </h2>
          <DeadlineMeta deadline={deadline} />
        </div>
        <StatusBadge status={computed.status} size="md" attentionGlyphOnly />
      </header>

      {/* min-h = the 34 px numeral line, so a "Passed 1 day ago" card lines up with its neighbour. */}
      <div className="flex min-h-[34px] flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <ZonedTime
          instantIso={deadline.deadlineAt}
          originalZone={deadline.timezone}
          layout="stacked"
          className="text-body"
        />
        <DeadlineCountdown targetIso={deadline.deadlineAt} size="row" className="text-right" />
      </div>

      <DualProgress
        timePercent={computed.timeProgress.clamped * 100}
        workPercent={deadline.progress}
        paceDifference={computed.paceDifference}
        hidePace={Math.abs(computed.paceDifference) < NOTABLE_PACE}
      />

      {links.length > 0 && (
        <p className="text-meta flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-3">{links}</p>
      )}
    </article>
  )
}
