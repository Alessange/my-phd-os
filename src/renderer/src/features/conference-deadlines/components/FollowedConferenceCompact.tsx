import { Bookmark } from 'lucide-react'
import { EMPTY_STATES } from '@shared/constants/emptyStates'
import { EmptyState } from '@renderer/components/common/EmptyState'

/** Nearest followed conference deadline (Calendar right panel). Shell stub: compact empty state only. */
export function FollowedConferenceCompact(): React.JSX.Element {
  return <EmptyState variant="compact" icon={Bookmark} title={EMPTY_STATES.nearestDeadline.title} />
}
