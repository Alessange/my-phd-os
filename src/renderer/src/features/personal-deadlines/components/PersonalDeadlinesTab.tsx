import { Timer } from 'lucide-react'
import { useState } from 'react'
import { EMPTY_STATES } from '@shared/constants/emptyStates'
import { EmptyState } from '@renderer/components/common/EmptyState'
import { PendingFeatureDialog } from '@renderer/components/common/PendingFeatureDialog'

/** Shell stub. The personal-deadlines feature replaces this file with cards/list/timeline views; keep the export name. */
export function PersonalDeadlinesTab(): React.JSX.Element {
  const [pending, setPending] = useState(false)
  const copy = EMPTY_STATES.personalDeadlines
  return (
    <>
      <EmptyState
        icon={Timer}
        title={copy.title}
        description={copy.description}
        actions={[{ label: copy.actions[0], onClick: () => setPending(true) }]}
      />
      <PendingFeatureDialog
        open={pending}
        onOpenChange={setPending}
        title="Add Personal Deadline"
        description="The personal deadline form (title, tracking start, deadline time and timezone, category, priority, progress) opens here once the personal-deadlines feature is installed."
      />
    </>
  )
}
