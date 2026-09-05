import { Rss } from 'lucide-react'
import { useState } from 'react'
import { EMPTY_STATES } from '@shared/constants/emptyStates'
import { EmptyState } from '@renderer/components/common/EmptyState'
import { PendingFeatureDialog } from '@renderer/components/common/PendingFeatureDialog'

/**
 * Shell stub for the builder + subscription list + refresh controls (used by Settings and the
 * Deadlines empty state). The conferences feature replaces this file; keep the export name.
 */
export function SubscriptionManager(): React.JSX.Element {
  const [pending, setPending] = useState(false)
  const copy = EMPTY_STATES.conferenceDeadlinesNoSubscription
  return (
    <>
      <EmptyState
        icon={Rss}
        variant="compact"
        title={copy.title}
        actions={[{ label: copy.actions[0], onClick: () => setPending(true), variant: 'outline' }]}
      />
      <PendingFeatureDialog
        open={pending}
        onOpenChange={setPending}
        title="Add CCF Subscription"
        description="The subscription builder and list (enable/disable, remove, refresh now, last refresh status) open here once the conference feature is installed."
      />
    </>
  )
}
