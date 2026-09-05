import { ArrowRight, BellRing, Check } from 'lucide-react'
import { useState } from 'react'
import {
  changeHeadline,
  changeLabel,
  changeValueText,
  sortChanges
} from '@shared/conferences/views'
import type { ConferenceDeadlineChangeView } from '@shared/types/conference'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { useFormat } from '@renderer/hooks/useFormat'

const INITIAL_VISIBLE = 4

export interface ConferenceChangesBannerProps {
  changes: readonly ConferenceDeadlineChangeView[]
  onAcknowledge: (ids: string[]) => void
  onOpen: (deadlineId: string) => void
  busy?: boolean
}

/**
 * Unacknowledged upstream changes (spec §12.8): "X was updated by CCF Deadlines." with the previous
 * and current values, followed conferences first, acknowledge one or all.
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

  return (
    <section
      aria-label="Updates from CCF Deadlines"
      className="flex flex-col gap-2 rounded-lg border border-status-at-risk/40 bg-status-at-risk/6 p-3"
      data-testid="changes-banner"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <BellRing className="size-4 text-status-at-risk" aria-hidden="true" />
          {pending.length === 1 ? '1 update' : `${pending.length} updates`} from CCF Deadlines
        </h3>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => onAcknowledge(pending.map((c) => c.id))}
        >
          <Check aria-hidden="true" />
          Acknowledge all
        </Button>
      </div>
      <ul className="flex flex-col gap-1.5">
        {shown.map((change) => (
          <li
            key={change.id}
            className="flex flex-wrap items-start justify-between gap-2 rounded-md bg-card/70 px-3 py-2 text-xs"
            data-change-id={change.id}
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  className="font-medium hover:underline"
                  onClick={() => onOpen(change.conferenceDeadlineId)}
                >
                  {changeHeadline(change)}
                </button>
                <Badge variant="outline">{changeLabel(change.field)}</Badge>
                {change.followed && <Badge colorToken="status-ahead">Followed</Badge>}
              </div>
              <div className="tabular flex flex-wrap items-center gap-1.5 text-muted-foreground">
                <span>
                  Previous: {changeValueText(change.field, change.previousValue, formatInstant)}
                </span>
                <ArrowRight className="size-3" aria-hidden="true" />
                <span className="text-foreground">
                  Current: {changeValueText(change.field, change.currentValue, formatInstant)}
                </span>
                <span>· detected {format.formatDateTime(change.detectedAt)}</span>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              aria-label={`Acknowledge update to ${change.conferenceTitle}`}
              onClick={() => onAcknowledge([change.id])}
            >
              <Check aria-hidden="true" />
              Acknowledge
            </Button>
          </li>
        ))}
      </ul>
      {pending.length > INITIAL_VISIBLE && (
        <Button
          size="sm"
          variant="ghost"
          className="self-start"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Show fewer' : `Show ${pending.length - INITIAL_VISIBLE} more`}
        </Button>
      )}
    </section>
  )
}
