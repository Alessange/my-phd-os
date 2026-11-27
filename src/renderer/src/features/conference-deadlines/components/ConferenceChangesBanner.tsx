import { useState } from 'react'
import {
  changeHeadline,
  changeLabel,
  changeValueText,
  sortChanges
} from '@shared/conferences/views'
import type { ConferenceDeadlineChangeView } from '@shared/types/conference'
import { useFormat } from '@renderer/hooks/useFormat'

const INITIAL_VISIBLE = 4

export interface ConferenceChangesBannerProps {
  changes: readonly ConferenceDeadlineChangeView[]
  onAcknowledge: (ids: string[]) => void
  onOpen: (deadlineId: string) => void
  busy?: boolean
}

/**
 * Unacknowledged upstream changes (spec §12.8) as quiet notes with a 1.5 px ink rule: the sentence
 * "X was updated by CCF Deadlines.", the field that changed, previous and current values, and an
 * `Acknowledge` text link. With several updates `Acknowledge all` sits beside the count.
 */
export function ConferenceChangesBanner({
  changes,
  onAcknowledge,
  onOpen,
  busy = false
}: ConferenceChangesBannerProps): React.JSX.Element | null {
  const format = useFormat()
  const [expanded, setExpanded] = useState(false)
  const pending = sortChanges(changes.filter((c) => !c.acknowledged))
  if (pending.length === 0) return null
  const shown = expanded ? pending : pending.slice(0, INITIAL_VISIBLE)
  const formatInstant = (iso: string): string => format.formatDateTimeWithZone(iso)
  const several = pending.length > 1

  return (
    <section
      aria-label="Updates from CCF Deadlines"
      className="flex flex-col gap-3"
      data-testid="changes-banner"
    >
      {several && (
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-body text-ink-2">{pending.length} updates from CCF Deadlines</h3>
          <button
            type="button"
            className="link app-no-drag"
            disabled={busy}
            onClick={() => onAcknowledge(pending.map((c) => c.id))}
          >
            Acknowledge all
          </button>
        </div>
      )}
      <ul className="flex flex-col gap-3">
        {shown.map((change) => (
          <li
            key={change.id}
            className="flex items-start justify-between gap-6 border-l-[1.5px] border-ink pl-4"
            data-change-id={change.id}
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <button
                  type="button"
                  className="hit-28 text-body text-left text-ink hover:underline"
                  onClick={() => onOpen(change.conferenceDeadlineId)}
                >
                  {changeHeadline(change)}
                </button>
                <span className="text-meta text-ink-3">{changeLabel(change.field)}</span>
              </div>
              <div className="text-meta tabular flex flex-wrap items-baseline gap-x-2 text-ink-3">
                <span>
                  Previous: {changeValueText(change.field, change.previousValue, formatInstant)}
                </span>
                <span aria-hidden="true">→</span>
                <span className="text-ink-2">
                  Current: {changeValueText(change.field, change.currentValue, formatInstant)}
                </span>
                <span>· detected {format.formatDateTime(change.detectedAt)}</span>
              </div>
            </div>
            <button
              type="button"
              className="link shrink-0"
              disabled={busy}
              aria-label={`Acknowledge update to ${change.conferenceTitle}`}
              onClick={() => onAcknowledge([change.id])}
            >
              Acknowledge
            </button>
          </li>
        ))}
      </ul>
      {pending.length > INITIAL_VISIBLE && (
        <button
          type="button"
          className="link-quiet self-start"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Show fewer' : `Show ${pending.length - INITIAL_VISIBLE} more`}
        </button>
      )}
    </section>
  )
}
