import { Bookmark } from 'lucide-react'
import { nearestFollowedDeadline } from '@shared/conferences/views'
import { EMPTY_STATES } from '@shared/constants/emptyStates'
import { tryResolveZone } from '@shared/dates/zones'
import { useNavigation } from '@renderer/app/navigation'
import { Countdown } from '@renderer/components/common/Countdown'
import { EmptyState } from '@renderer/components/common/EmptyState'
import { ErrorState } from '@renderer/components/common/ErrorState'
import { LoadingState } from '@renderer/components/common/LoadingState'
import { StatusBadge } from '@renderer/components/common/StatusBadge'
import { useFormat } from '@renderer/hooks/useFormat'
import { useNow } from '@renderer/hooks/useNow'
import { useFollowedConferences } from '../api'

/**
 * Nearest followed conference deadline (Calendar right panel, spec §9.4 / §12.6). Unfollowed
 * conferences never appear here; opens the card on the Deadlines page.
 */
export function FollowedConferenceCompact(): React.JSX.Element {
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
  if (!nearest || !nearest.deadlineAt)
    return (
      <EmptyState variant="compact" icon={Bookmark} title={EMPTY_STATES.nearestDeadline.title} />
    )

  const zoneLabel = nearest.originalTimezoneLabel ?? nearest.originalTimezone
  const zone = zoneLabel ? tryResolveZone(zoneLabel) : undefined
  return (
    <button
      type="button"
      onClick={() => navigate('deadlines', { tab: 'conference', id: nearest.id })}
      className="flex w-full flex-col gap-1 rounded-md border bg-card px-3 py-2 text-left shadow-xs transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      data-conference-id={nearest.id}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-medium">{nearest.title}</span>
        <StatusBadge status={nearest.status} size="sm" />
      </span>
      <Countdown targetIso={nearest.deadlineAt} variant="inline" className="text-xs font-medium" />
      <span className="tabular text-[11px] text-muted-foreground">
        {format.formatDateTimeWithZone(nearest.deadlineAt, zone)}
        {zone && ` · Local: ${format.formatDateTimeWithZone(nearest.deadlineAt)}`}
      </span>
    </button>
  )
}
