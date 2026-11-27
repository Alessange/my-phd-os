import { nearestFollowedDeadline } from '@shared/conferences/views'
import { EMPTY_STATES } from '@shared/constants/emptyStates'
import { describeDeadlines, nearestUpcomingDeadline } from '@shared/personal-deadlines/views'
import { EmptyState } from '@renderer/components/common/EmptyState'
import { useFollowedConferences } from '@renderer/features/conference-deadlines/api'
import { FollowedConferenceCompact } from '@renderer/features/conference-deadlines/components/FollowedConferenceCompact'
import { usePersonalDeadlines } from '@renderer/features/personal-deadlines/api'
import { PersonalDeadlineCompact } from '@renderer/features/personal-deadlines/components/PersonalDeadlineCompact'
import { useNow } from '@renderer/hooks/useNow'

/**
 * The right panel's `Nearest deadline` body (DESIGN.md 8.3): up to one personal and one followed
 * conference deadline, a hairline between them, and a single `No active deadline.` line when both
 * are empty (each compact would otherwise print its own). Reads the same queries as the compacts.
 */
export function NearestDeadlines(): React.JSX.Element {
  const nowIso = useNow({ precision: 'minute' })
  const personal = usePersonalDeadlines()
  const followed = useFollowedConferences()
  const settled = personal.isSuccess && followed.isSuccess
  const empty =
    settled &&
    !nearestUpcomingDeadline(describeDeadlines(personal.data, nowIso)) &&
    !nearestFollowedDeadline(followed.data, nowIso)?.deadlineAt

  if (empty) return <EmptyState variant="compact" title={EMPTY_STATES.nearestDeadline.title} />
  return (
    <div className="flex flex-col divide-y divide-line [&>*]:py-3 [&>:first-child]:pt-1 [&>:last-child]:pb-0">
      <PersonalDeadlineCompact hideEmpty />
      <FollowedConferenceCompact hideEmpty />
    </div>
  )
}
