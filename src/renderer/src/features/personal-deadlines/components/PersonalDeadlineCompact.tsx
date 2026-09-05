import { Timer } from 'lucide-react'
import { EMPTY_STATES } from '@shared/constants/emptyStates'
import { describeDeadlines, nearestUpcomingDeadline } from '@shared/personal-deadlines/views'
import { useNavigation } from '@renderer/app/navigation'
import { Countdown } from '@renderer/components/common/Countdown'
import { EmptyState } from '@renderer/components/common/EmptyState'
import { ErrorState } from '@renderer/components/common/ErrorState'
import { LoadingState } from '@renderer/components/common/LoadingState'
import { StatusBadge } from '@renderer/components/common/StatusBadge'
import { useFormat } from '@renderer/hooks/useFormat'
import { useNow } from '@renderer/hooks/useNow'
import { usePersonalDeadlines } from '../api'

/** Nearest upcoming personal deadline (Calendar right panel); opens its details on the Deadlines page. */
export function PersonalDeadlineCompact(): React.JSX.Element {
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
  if (!nearest)
    return <EmptyState variant="compact" icon={Timer} title={EMPTY_STATES.nearestDeadline.title} />

  const { deadline, computed } = nearest
  return (
    <button
      type="button"
      onClick={() => navigate('deadlines', { tab: 'personal', id: deadline.id })}
      className="flex w-full flex-col gap-1 rounded-md border bg-card px-3 py-2 text-left shadow-xs transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      data-deadline-id={deadline.id}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-medium">{deadline.title}</span>
        <StatusBadge status={computed.status} size="sm" />
      </span>
      <Countdown targetIso={deadline.deadlineAt} variant="inline" className="text-xs font-medium" />
      <span className="tabular text-[11px] text-muted-foreground">
        {format.formatDateTimeWithZone(deadline.deadlineAt, deadline.timezone)}
      </span>
    </button>
  )
}
