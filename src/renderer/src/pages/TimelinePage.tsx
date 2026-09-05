import { Plus, Route } from 'lucide-react'
import { useCallback, useState } from 'react'
import { EMPTY_STATES } from '@shared/constants/emptyStates'
import { useRegisterQuickCreate } from '@renderer/app/quickCreate'
import { EmptyState } from '@renderer/components/common/EmptyState'
import { PageHeader } from '@renderer/components/common/PageHeader'
import { PendingFeatureDialog } from '@renderer/components/common/PendingFeatureDialog'
import { Button } from '@renderer/components/ui/button'

/** Timeline page shell. The timeline feature replaces this file (views, now-marker, milestone bars, warnings). */
export default function TimelinePage(): React.JSX.Element {
  const [pending, setPending] = useState(false)
  const openCreate = useCallback(() => setPending(true), [])
  useRegisterQuickCreate('timeline', openCreate)

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <PageHeader
        title="Timeline"
        subtitle="Your long-term PhD plan: milestones as time bars with work progress, against today."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus aria-hidden="true" />
            Add Milestone
          </Button>
        }
      />
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          icon={Route}
          title={EMPTY_STATES.timeline.title}
          description="Add a milestone with a start and target date to see where you are in the semester, the year, and the whole programme."
          actions={[{ label: EMPTY_STATES.timeline.actions[0], onClick: openCreate, icon: Plus }]}
        />
      </div>
      <PendingFeatureDialog
        open={pending}
        onOpenChange={setPending}
        title="Add Milestone"
        description="The milestone editor (title, start, target, category, status, progress) opens here once the timeline feature is installed."
      />
    </div>
  )
}
