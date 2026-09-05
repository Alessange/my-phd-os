import { ChevronRight, RotateCcw, TriangleAlert, X } from 'lucide-react'
import { RULE_LABELS, type TimelineWarning } from '@shared/timeline/detectTimelineWarnings'
import { Button } from '@renderer/components/ui/button'

export interface TimelineWarningsProps {
  /** Detected warnings the user has not dismissed. */
  warnings: TimelineWarning[]
  /** Detected warnings whose key is currently dismissed (offered for restore). */
  dismissed: TimelineWarning[]
  onOpen: (warning: TimelineWarning) => void
  onDismiss: (warning: TimelineWarning) => void
  onRestore: (warning: TimelineWarning) => void
}

/**
 * Timeline checks panel (spec §15.3). Every card states the problem, the entities and dates behind
 * it, the rule that fired, and offers Open (navigate) and Dismiss. Dismissals are keyed by the
 * warning's stable id so they survive re-detection; still-detected dismissed warnings can be restored.
 */
export function TimelineWarnings({
  warnings,
  dismissed,
  onOpen,
  onDismiss,
  onRestore
}: TimelineWarningsProps): React.JSX.Element {
  if (warnings.length === 0 && dismissed.length === 0) {
    return (
      <p
        role="status"
        className="rounded-lg border bg-card px-4 py-2.5 text-[13px] text-muted-foreground shadow-xs"
      >
        Timeline checks: no issues detected across your milestones and linked deadlines.
      </p>
    )
  }
  return (
    <section aria-labelledby="timeline-checks-heading" className="flex flex-col gap-2">
      <h2 id="timeline-checks-heading" className="text-sm font-semibold">
        Timeline checks{' '}
        <span className="font-normal text-muted-foreground">({warnings.length} open)</span>
      </h2>
      {warnings.length === 0 && (
        <p className="text-[13px] text-muted-foreground">No open issues.</p>
      )}
      <ul className="flex flex-col gap-2">
        {warnings.map((warning) => (
          <li
            key={warning.id}
            data-rule={warning.rule}
            className="flex items-start gap-3 rounded-lg border border-status-at-risk/40 bg-status-at-risk/6 px-4 py-3"
          >
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0 text-status-at-risk"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium">{warning.title}</p>
              <p className="text-xs text-muted-foreground">{warning.detail}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Rule: {RULE_LABELS[warning.rule]}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => onOpen(warning)}>
                Open
                <ChevronRight aria-hidden="true" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Dismiss: ${warning.title}`}
                onClick={() => onDismiss(warning)}
              >
                <X aria-hidden="true" />
                Dismiss
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {dismissed.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">Dismissed ({dismissed.length})</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {dismissed.map((warning) => (
              <li
                key={warning.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-1.5"
              >
                <span className="truncate">{warning.title}</span>
                <Button size="sm" variant="ghost" onClick={() => onRestore(warning)}>
                  <RotateCcw aria-hidden="true" />
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
