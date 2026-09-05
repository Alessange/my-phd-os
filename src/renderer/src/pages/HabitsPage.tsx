import { Plus, Repeat } from 'lucide-react'
import { useCallback, useState } from 'react'
import { EMPTY_STATES } from '@shared/constants/emptyStates'
import { useRegisterQuickCreate } from '@renderer/app/quickCreate'
import { EmptyState } from '@renderer/components/common/EmptyState'
import { PageHeader } from '@renderer/components/common/PageHeader'
import { PendingFeatureDialog } from '@renderer/components/common/PendingFeatureDialog'
import { Button } from '@renderer/components/ui/button'

/** Habits page shell. The habits feature replaces this file (today list, streaks, heatmap, weekly bars). */
export default function HabitsPage(): React.JSX.Element {
  const [pending, setPending] = useState(false)
  const openCreate = useCallback(() => setPending(true), [])
  useRegisterQuickCreate('habits', openCreate)

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <PageHeader
        title="Habits"
        subtitle="A few routines worth keeping: daily, weekly targets, or specific weekdays."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus aria-hidden="true" />
            Create Habit
          </Button>
        }
      />
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          icon={Repeat}
          title={EMPTY_STATES.habits.title}
          description="Create a habit such as Exercise, Reading or Deep Work. Streaks and completion grids appear as you check things off."
          actions={[{ label: EMPTY_STATES.habits.actions[0], onClick: openCreate, icon: Plus }]}
        />
      </div>
      <PendingFeatureDialog
        open={pending}
        onOpenChange={setPending}
        title="Create Habit"
        description="The habit form (name, colour, icon, frequency) opens here once the habits feature is installed."
      />
    </div>
  )
}
