import { CircleAlert } from 'lucide-react'
import { nearestFollowedDeadline } from '@shared/conferences/views'
import { EMPTY_STATES } from '@shared/constants/emptyStates'
import { urgencyLevel } from '@shared/conferences/views'
import { tryResolveZone } from '@shared/dates/zones'
import { useNavigation } from '@renderer/app/navigation'
import { EmptyState } from '@renderer/components/common/EmptyState'
import { ErrorState } from '@renderer/components/common/ErrorState'
import { LoadingState } from '@renderer/components/common/LoadingState'
import { StatusMark } from '@renderer/components/ui/status-mark'
import { useFormat } from '@renderer/hooks/useFormat'
import { useNow } from '@renderer/hooks/useNow'
import { useFollowedConferences } from '../api'
import { DeadlineCountdown } from './DeadlineCountdown'

/**
 * Nearest followed conference deadline (Calendar right panel, spec §9.4 / §12.6). Unfollowed
 * conferences never appear here; opens the card on the Deadlines page.
 */
export interface FollowedConferenceCompactProps {
  /** Render nothing (instead of the empty line) when no followed deadline is upcoming; the caller shows one shared line. */
  hideEmpty?: boolean
}

export function FollowedConferenceCompact({
  hideEmpty = false
}: FollowedConferenceCompactProps): React.JSX.Element | null {
  const format = useFormat()
  const nowIso = useNow({ precision: 'minute' })
  const navigate = useNavigation((state) => state.navigate)
  const query = useFollowedConferences()

  if (query.isPending)
    return <LoadingState variant="inline" label="Loading followed conferences…" />
  if (query.isError)
    return (
      <ErrorState
        variant="compact"
        error={query.error}
        title="Could not load followed conferences"
        onRetry={() => void query.refetch()}
      />
    )
  const nearest = nearestFollowedDeadline(query.data, nowIso)
  if (!nearest || !nearest.deadlineAt) {
    return hideEmpty ? null : (
      <EmptyState variant="compact" title={EMPTY_STATES.nearestDeadline.title} />
    )
  }

  const zoneLabel = nearest.originalTimezoneLabel ?? nearest.originalTimezone
  const zone = zoneLabel ? tryResolveZone(zoneLabel) : undefined
  const urgent = urgencyLevel(nearest, nowIso) === 'urgent'
  const localText = format.formatDateTimeWithZone(nearest.deadlineAt)
  const originalText = zone ? format.formatDateTimeWithZone(nearest.deadlineAt, zone) : undefined
  return (
    <button
      type="button"
      onClick={() => navigate('deadlines', { tab: 'conference', id: nearest.id })}
      className="app-no-drag flex w-full flex-col items-start gap-1 rounded-sm text-left"
      data-conference-id={nearest.id}
    >
      <span className="text-body w-full truncate text-ink">{nearest.title}</span>
      <DeadlineCountdown targetIso={nearest.deadlineAt} status={nearest.status} size="compact" />
      <span className="text-meta flex items-center gap-2 text-ink-3">
        Conference
        {urgent && (
          <StatusMark
            label="Urgent"
            colorToken="status-urgent"
            glyph={<CircleAlert aria-hidden="true" />}
          />
        )}
      </span>
      <span
        className="text-meta tabular text-ink-3"
        title={originalText && originalText !== localText ? `Original: ${originalText}` : undefined}
      >
        {localText}
      </span>
    </button>
  )
}
