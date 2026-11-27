import { EMPTY_STATES } from '@shared/constants/emptyStates'
import { describeDeadlines, nearestUpcomingDeadline } from '@shared/personal-deadlines/views'
import { useNavigation } from '@renderer/app/navigation'
import { EmptyState } from '@renderer/components/common/EmptyState'
import { ErrorState } from '@renderer/components/common/ErrorState'
import { LoadingState } from '@renderer/components/common/LoadingState'
import { StatusBadge } from '@renderer/components/common/StatusBadge'
import { DeadlineCountdown } from '@renderer/features/conference-deadlines/components/DeadlineCountdown'
import { useFormat } from '@renderer/hooks/useFormat'
import { useNow } from '@renderer/hooks/useNow'
import { usePersonalDeadlines } from '../api'

export interface PersonalDeadlineCompactProps {
  /** Render nothing (instead of the empty line) when there is no upcoming deadline; the caller shows one shared line. */
  hideEmpty?: boolean
}

/** Nearest upcoming personal deadline (Calendar right panel); opens its details on the Deadlines page. */
export function PersonalDeadlineCompact({
  hideEmpty = false
}: PersonalDeadlineCompactProps): React.JSX.Element | null {
  const format = useFormat()
  const nowIso = useNow({ precision: 'minute' })
  const navigate = useNavigation((state) => state.navigate)
  const query = usePersonalDeadlines()

  if (query.isPending) return <LoadingState variant="inline" label="Loading deadlines…" />
  if (query.isError)
    return (
      <ErrorState
        variant="compact"
        error={query.error}
        title="Could not load deadlines"
        onRetry={() => void query.refetch()}
      />
    )
  const nearest = nearestUpcomingDeadline(describeDeadlines(query.data, nowIso))
  if (!nearest) {
    return hideEmpty ? null : (
      <EmptyState variant="compact" title={EMPTY_STATES.nearestDeadline.title} />
    )
  }

  const { deadline, computed } = nearest
  return (
    <button
      type="button"
      onClick={() => navigate('deadlines', { tab: 'personal', id: deadline.id })}
      className="app-no-drag flex w-full flex-col items-start gap-1 rounded-sm text-left"
      data-deadline-id={deadline.id}
    >
      <span className="text-body w-full truncate text-ink">{deadline.title}</span>
      <DeadlineCountdown targetIso={deadline.deadlineAt} size="compact" />
      <span className="text-meta flex items-center gap-2 text-ink-3">
        Personal
        <StatusBadge status={computed.status} size="sm" attentionGlyphOnly />
      </span>
      <span className="text-meta tabular text-ink-3">
        {format.formatDateTimeWithZone(deadline.deadlineAt, deadline.timezone)}
      </span>
    </button>
  )
}
