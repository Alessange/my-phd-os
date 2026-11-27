import { useId, useState } from 'react'
import { RULE_LABELS, type TimelineWarning } from '@shared/timeline/detectTimelineWarnings'
import type { Milestone } from '@shared/types/milestone'
import { cn } from '@renderer/lib/utils'
import {
  RULE_PRESENTATION,
  conciseDetail,
  sortWarnings,
  summarizeWarnings,
  titleSegments
} from '../checks'

const NO_MILESTONES: Milestone[] = []

/** With this many open checks or fewer the rows are shown straight away; more collapse to one line. */
const EXPANDED_BY_DEFAULT_MAX = 2

export interface TimelineWarningsProps {
  /** Detected warnings the user has not dismissed. */
  warnings: TimelineWarning[]
  /** Detected warnings whose key is currently dismissed (offered for restore). */
  dismissed: TimelineWarning[]
  onOpen: (warning: TimelineWarning) => void
  onDismiss: (warning: TimelineWarning) => void
  onRestore: (warning: TimelineWarning) => void
  /** Open one named milestone (each name in a pair check is its own link). */
  onOpenMilestone?: (milestoneId: string) => void
  /** Used to link the milestone names a pair check mentions. */
  milestones?: Milestone[]
  className?: string
}

/**
 * Timeline checks (spec §15.3). At rest one quiet line (`4 open · 1 past target · 3 overlaps`) and a
 * Review link; opened, hairline rows with the rule tag, the problem, its cause, and Open / Dismiss
 * text links. Every row still states the problem, the entities and dates behind it and the rule that
 * fired (sr-only `Rule:` line); dismissals are keyed by the warning's stable id and can be restored.
 */
export function TimelineWarnings({
  warnings,
  dismissed,
  onOpen,
  onDismiss,
  onRestore,
  onOpenMilestone,
  milestones = NO_MILESTONES,
  className
}: TimelineWarningsProps): React.JSX.Element {
  const listId = useId()
  const headingId = useId()
  const [toggled, setToggled] = useState<boolean | undefined>()
  const open = sortWarnings(warnings)
  const restorable = sortWarnings(dismissed)
  const expanded = open.length === 0 ? false : (toggled ?? open.length <= EXPANDED_BY_DEFAULT_MAX)

  return (
    <section aria-labelledby={headingId} className={cn('flex flex-col', className)}>
      <div className="flex min-h-9 items-baseline justify-between gap-6 border-b border-line pb-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-4">
          <h2 id={headingId} className="text-lead text-ink">
            Timeline checks
          </h2>
          <span role="status" className="text-meta text-ink-3">
            {open.length === 0 ? 'No issues' : summarizeWarnings(open)}
          </span>
        </div>
        {open.length > 0 && (
          <button
            type="button"
            className="link-quiet shrink-0 text-meta"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => setToggled(!expanded)}
          >
            {expanded ? 'Hide' : 'Review'}
          </button>
        )}
      </div>

      {expanded && (
        <ul id={listId} className="divide-y divide-line">
          {open.map((warning, index) => (
            <li
              key={warning.id}
              data-rule={warning.rule}
              className="grid grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-1 py-3 min-[1100px]:grid-cols-[112px_1fr_auto]"
            >
              <span className="small-caps hidden min-[1100px]:block">
                {RULE_PRESENTATION[warning.rule].tag}
              </span>
              <p className={cn('min-w-0 text-body', index === 0 ? 'text-ink' : 'text-ink-2')}>
                <span className="sr-only">Rule: {RULE_LABELS[warning.rule]}. </span>
                {titleSegments(warning.title, warning, milestones).map((segment, at) =>
                  segment.milestoneId && onOpenMilestone ? (
                    <button
                      key={at}
                      type="button"
                      className="link text-left"
                      onClick={() => onOpenMilestone(segment.milestoneId as string)}
                    >
                      {segment.text}
                    </button>
                  ) : (
                    <span key={at}>{segment.text}</span>
                  )
                )}
                <span className="ml-3 text-meta text-ink-3">{conciseDetail(warning.detail)}</span>
              </p>
              <span className="flex shrink-0 gap-5 text-meta">
                <button
                  type="button"
                  className="link-quiet py-1"
                  aria-label={`Open: ${warning.title}`}
                  onClick={() => onOpen(warning)}
                >
                  Open
                </button>
                <button
                  type="button"
                  className="link-quiet py-1"
                  aria-label={`Dismiss: ${warning.title}`}
                  onClick={() => onDismiss(warning)}
                >
                  Dismiss
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {restorable.length > 0 && (open.length === 0 || expanded) && (
        <details className="pt-3 text-meta text-ink-3">
          <summary className="link-quiet w-fit cursor-default list-none [&::-webkit-details-marker]:hidden">
            Dismissed ({restorable.length})
          </summary>
          <ul className="mt-2 divide-y divide-line">
            {restorable.map((warning) => (
              <li key={warning.id} className="flex items-baseline justify-between gap-6 py-2">
                <span className="min-w-0 truncate" title={warning.title}>
                  {warning.title}
                </span>
                <button
                  type="button"
                  className="link-quiet shrink-0 py-1"
                  onClick={() => onRestore(warning)}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
