import { useCallback, useMemo, useState } from 'react'
import { EMPTY_STATES } from '@shared/constants/emptyStates'
import { addDays, todayInZone } from '@shared/dates'
import { isDueOn, toCompletedSet } from '@shared/habits/streaks'
import type { Habit, HabitCompletion } from '@shared/types/habit'
import { CREATE_LABELS, useNavigation } from '@renderer/app/navigation'
import { useRegisterQuickCreate } from '@renderer/app/quickCreate'
import { EmptyState } from '@renderer/components/common/EmptyState'
import { ErrorState } from '@renderer/components/common/ErrorState'
import { LoadingState } from '@renderer/components/common/LoadingState'
import { Page } from '@renderer/components/common/Page'
import { PageAction } from '@renderer/components/common/PageAction'
import { PageHeader } from '@renderer/components/common/PageHeader'
import { Button } from '@renderer/components/ui/button'
import { SectionHeading } from '@renderer/components/ui/section'
import { useHabitCompletions, useHabits } from '@renderer/features/habits/api'
import { HabitCard, HABIT_ROW_COLUMNS } from '@renderer/features/habits/components/HabitCard'
import { HabitForm } from '@renderer/features/habits/components/HabitForm'
import { HISTORY_DAYS } from '@renderer/features/habits/habitDisplay'
import { useFormat } from '@renderer/hooks/useFormat'
import { useNow } from '@renderer/hooks/useNow'
import { cn } from '@renderer/lib/utils'

const LIST = 'flex flex-col divide-y divide-line'

/**
 * Habits page: one hairline list, one done control per habit, each row with its cadence, a quiet
 * 10-week grid, this week's progress and the streak. Archived habits sit in a collapsed list below.
 */
export default function HabitsPage(): React.JSX.Element {
  const { zone } = useFormat()
  const nowIso = useNow({ precision: 'minute' })
  const todayKey = todayInZone(zone, nowIso)
  const from = addDays(todayKey, -(HISTORY_DAYS - 1))

  const habits = useHabits({ includeArchived: true })
  const completions = useHabitCompletions({ from, to: todayKey })
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Habit | undefined>()
  const [showArchived, setShowArchived] = useState(false)

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

  const completionsByHabit = useMemo(() => {
    const map = new Map<string, HabitCompletion[]>()
    for (const c of completions.data ?? []) {
      const list = map.get(c.habitId)
      if (list) list.push(c)
      else map.set(c.habitId, [c])
    }
    return map
  }, [completions.data])

  // Today's tally and the one habit still to do next (the only bold text on the page).
  const { dueCount, doneCount, nextId } = useMemo(() => {
    let due = 0
    let done = 0
    let next: string | undefined
    for (const habit of active) {
      if (!isDueOn(habit.frequency, todayKey)) continue
      due++
      if (toCompletedSet(completionsByHabit.get(habit.id) ?? []).has(todayKey)) done++
      else next ??= habit.id
    }
    return { dueCount: due, doneCount: done, nextId: next }
  }, [active, completionsByHabit, todayKey])

  const loaded = !habits.isPending && !completions.isPending
  const failed = habits.isError || completions.isError
  const isEmpty = loaded && !failed && (habits.data?.length ?? 0) === 0

  let subtitle: string | undefined
  if (loaded && !failed && !isEmpty) {
    subtitle =
      dueCount > 0 ? `${doneCount} of ${dueCount} done today.` : EMPTY_STATES.todayHabits.title
  }

  let body: React.ReactNode
  if (!loaded) {
    body = <LoadingState variant="skeleton" label="Loading habits…" />
  } else if (failed) {
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
  } else if (isEmpty) {
    body = (
      <EmptyState
        title={EMPTY_STATES.habits.title}
        description="Add a routine you want to keep, then check it off each day."
        actions={[{ label: EMPTY_STATES.habits.actions[0], onClick: openCreate }]}
      />
    )
  } else {
    body = (
      <>
        {active.length > 0 ? (
          <div className="flex flex-col">
            <div
              aria-hidden="true"
              className={cn(
                HABIT_ROW_COLUMNS,
                'items-end border-b border-ink pb-1 text-meta text-ink-3'
              )}
            >
              <span>Today</span>
              <span>Last 10 weeks</span>
              <span>This week</span>
              <span className="text-right">Streak</span>
              <span />
            </div>
            <ul role="list" aria-label="Habits" className={LIST}>
              {active.map((habit, index) => (
                <HabitCard
                  key={habit.id}
                  habit={habit}
                  completions={completionsByHabit.get(habit.id) ?? []}
                  todayKey={todayKey}
                  onEdit={onEdit}
                  next={habit.id === nextId}
                  weekdayLabels={index === 0}
                />
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-body text-ink-2">All of your habits are archived.</p>
        )}

        {archived.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline gap-4">
              <SectionHeading count={archived.length}>Archived</SectionHeading>
              <button
                type="button"
                className="link-quiet text-body"
                aria-expanded={showArchived || active.length === 0}
                onClick={() => setShowArchived((open) => !open)}
              >
                {showArchived || active.length === 0 ? 'Hide' : 'Show'}
              </button>
            </div>
            {(showArchived || active.length === 0) && (
              <ul role="list" aria-label="Archived habits" className={LIST}>
                {archived.map((habit) => (
                  <HabitCard
                    key={habit.id}
                    habit={habit}
                    completions={completionsByHabit.get(habit.id) ?? []}
                    todayKey={todayKey}
                    onEdit={onEdit}
                  />
                ))}
              </ul>
            )}
          </section>
        )}
      </>
    )
  }

  return (
    <Page className="gap-8">
      <PageHeader title="Habits" subtitle={subtitle} />
      {loaded && !failed && !isEmpty && (
        <PageAction>
          <Button size="sm" onClick={openCreate}>
            {CREATE_LABELS.habit}
          </Button>
        </PageAction>
      )}
      {body}
      <HabitForm open={formOpen} onOpenChange={handleFormOpenChange} habit={editing} />
    </Page>
  )
}
