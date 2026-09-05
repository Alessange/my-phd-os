import { Repeat } from 'lucide-react'
import { EMPTY_STATES } from '@shared/constants/emptyStates'
import { EmptyState } from '@renderer/components/common/EmptyState'

/** Today's habits with toggles + streak (Calendar right panel). Shell stub: compact empty state only. */
export function TodayHabitsCompact(): React.JSX.Element {
  return <EmptyState variant="compact" icon={Repeat} title={EMPTY_STATES.todayHabits.title} />
}
