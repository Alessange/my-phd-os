import { Plus, Repeat } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { EMPTY_STATES } from '@shared/constants/emptyStates'
import { addDays, todayInZone } from '@shared/dates'
import type { Habit, HabitCompletion } from '@shared/types/habit'
import { useNavigation } from '@renderer/app/navigation'
import { useRegisterQuickCreate } from '@renderer/app/quickCreate'
import { EmptyState } from '@renderer/components/common/EmptyState'
import { ErrorState } from '@renderer/components/common/ErrorState'
import { LoadingState } from '@renderer/components/common/LoadingState'
import { PageHeader } from '@renderer/components/common/PageHeader'
import { Button } from '@renderer/components/ui/button'
import { useHabitCompletions, useHabits } from '@renderer/features/habits/api'
import { HabitCard } from '@renderer/features/habits/components/HabitCard'
import { HabitForm } from '@renderer/features/habits/components/HabitForm'
import { TodayHabitsCompact } from '@renderer/features/habits/components/TodayHabitsCompact'
import { useFormat } from '@renderer/hooks/useFormat'
import { useNow } from '@renderer/hooks/useNow'

const HISTORY_DAYS = 90

/** Habits page: today's due habits at the top, then a card grid with streaks, weekly progress and heatmaps. */
export default function HabitsPage(): React.JSX.Element {
  const { zone } = useFormat()
  const nowIso = useNow({ precision: 'minute' })
  const todayKey = todayInZone(zone, nowIso)
  const from = addDays(todayKey, -(HISTORY_DAYS - 1))

  const habits = useHabits({ includeArchived: true })
  const completions = useHabitCompletions({ from, to: todayKey })
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Habit | undefined>()

  const openCreate = useCallback(() => {
    setEditing(undefined)
    setFormOpen(true)
  }, [])
  useRegisterQuickCreate('habits', openCreate)

  const navigate = useNavigation((state) => state.navigate)
  const createParam = useNavigation((state) => state.params.create)
  const [lastCreate, setLastCreate] = useState<string | undefined>(undefined)
  // Palette "Create Habit" navigates here with `{ create }`. Track the param's current value (derived
  // during render, not in an effect) so the form opens on every arrival, including a repeat after
  // the param was cleared on close.
  if (createParam !== lastCreate) {
    setLastCreate(createParam)
    if (createParam !== undefined) {
      setEditing(undefined)
      setFormOpen(true)
    }
  }
  const handleFormOpenChange = (open: boolean): void => {
    setFormOpen(open)
    if (!open) {
      setEditing(undefined)
      if (createParam !== undefined) navigate('habits')
    }
  }

  const active = useMemo(
    () => (habits.data ?? []).filter((h) => h.archivedAt === undefined),
    [habits.data]
  )
  const archived = useMemo(
    () => (habits.data ?? []).filter((h) => h.archivedAt !== undefined),
    [habits.data]
  )

  const onEdit = useCallback((habit: Habit) => {
    setEditing(habit)
    setFormOpen(true)
  }, [])

  const completionsFor = (habit: Habit): HabitCompletion[] =>
    (completions.data ?? []).filter((c) => c.habitId === habit.id)

  let body: React.ReactNode
  if (habits.isPending || completions.isPending) {
    body = <LoadingState label="Loading habits…" />
  } else if (habits.isError || completions.isError) {
    body = (
      <ErrorState
        error={habits.error ?? completions.error}
        title="Could not load your habits"
        onRetry={() => {
          void habits.refetch()
          void completions.refetch()
        }}
      />
    )
  } else if ((habits.data?.length ?? 0) === 0) {
    body = (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          icon={Repeat}
          title={EMPTY_STATES.habits.title}
          description="Create a habit such as Exercise, Reading or Deep Work. Streaks and completion grids appear as you check things off."
          actions={[{ label: EMPTY_STATES.habits.actions[0], onClick: openCreate, icon: Plus }]}
        />
      </div>
    )
  } else {
    body = (
      <>
        <section className="rounded-lg border bg-card p-4 shadow-xs">
          <h2 className="mb-2 text-sm font-semibold">Today</h2>
          <TodayHabitsCompact />
        </section>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="list" aria-label="Habits">
          {active.map((habit) => (
            <div key={habit.id} role="listitem">
              <HabitCard
                habit={habit}
                completions={completionsFor(habit)}
                todayKey={todayKey}
                onEdit={onEdit}
              />
            </div>
          ))}
        </div>

        {archived.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-muted-foreground">Archived</h2>
            <div
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              role="list"
              aria-label="Archived habits"
            >
              {archived.map((habit) => (
                <div key={habit.id} role="listitem">
                  <HabitCard
                    habit={habit}
                    completions={completionsFor(habit)}
                    todayKey={todayKey}
                    onEdit={onEdit}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </>
    )
  }

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
      {body}
      <HabitForm open={formOpen} onOpenChange={handleFormOpenChange} habit={editing} />
    </div>
  )
}
