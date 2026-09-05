import { CalendarClock } from 'lucide-react'
import { useState } from 'react'
import { EMPTY_STATES } from '@shared/constants/emptyStates'
import { EmptyState } from '@renderer/components/common/EmptyState'
import { PendingFeatureDialog } from '@renderer/components/common/PendingFeatureDialog'

/**
 * Shell stub. The conferences feature replaces this file with the real tab (subscription-aware
 * empty/loading/error states, cards, filters). Keep the export name.
 */
export function ConferenceDeadlinesTab(): React.JSX.Element {
  const [pending, setPending] = useState<'builder' | 'url' | undefined>()
  const copy = EMPTY_STATES.conferenceDeadlinesNoSubscription
  return (
    <>
      <EmptyState
        icon={CalendarClock}
        title={copy.title}
        description="Subscribe to the official CCF Deadlines feed to see conference deadlines with exact countdowns. Nothing is fetched until you add a subscription."
        actions={[
          { label: copy.actions[0], onClick: () => setPending('builder') },
          { label: copy.actions[1], onClick: () => setPending('url') }
        ]}
      />
      <PendingFeatureDialog
        open={pending !== undefined}
        onOpenChange={(open) => !open && setPending(undefined)}
        title={pending === 'url' ? 'Enter Subscription URL' : 'Add CCF Subscription'}
        description={
          pending === 'url'
            ? 'The custom subscription URL form (with host validation and the non-official source warning) opens here once the conference feature is installed.'
            : 'The visual subscription builder (language, CCF / CORE / TH-CPL ranks, subject, URL preview) opens here once the conference feature is installed.'
        }
      />
    </>
  )
}
