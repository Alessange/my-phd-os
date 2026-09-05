import { Timer } from 'lucide-react'
import { EMPTY_STATES } from '@shared/constants/emptyStates'
import { EmptyState } from '@renderer/components/common/EmptyState'

/** Nearest active personal deadline (Calendar right panel). Shell stub: compact empty state only. */
export function PersonalDeadlineCompact(): React.JSX.Element {
  return <EmptyState variant="compact" icon={Timer} title={EMPTY_STATES.nearestDeadline.title} />
}
