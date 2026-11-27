import { useMemo } from 'react'
import { EMPTY_STATES } from '@shared/constants/emptyStates'
import { addDays, todayInZone } from '@shared/dates'
import { calculateHabitStats, isDueOn } from '@shared/habits/streaks'
import { EmptyState } from '@renderer/components/common/EmptyState'
import { ErrorState } from '@renderer/components/common/ErrorState'
import { LoadingState } from '@renderer/components/common/LoadingState'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { useFormat } from '@renderer/hooks/useFormat'
import { useNow } from '@renderer/hooks/useNow'
import { cn } from '@renderer/lib/utils'
import { useHabitCompletions, useHabits, useSetCompletion } from '../api'
import { HISTORY_DAYS, streakUnit } from '../habitDisplay'

/**
 * Today's due habits with one done control and the current streak (Calendar right panel). Names stay
 * in full ink until done, then step down to ink-3; nothing is struck through. Compact empty state
 * when there are no habits or none are scheduled today.
 */
export function TodayHabitsCompact(): React.JSX.Element {
  const { zone, settings } = useFormat()
  const nowIso = useNow({ precision: 'minute' })
  const todayKey = todayInZone(zone, nowIso)
  const from = addDays(todayKey, -(HISTORY_DAYS - 1))

  const habits = useHabits()
  const completions = useHabitCompletions({ from, to: todayKey })
  const setCompletion = useSetCompletion()

  const dueToday = useMemo(() => {
    const list = habits.data ?? []
    return list.filter((h) => h.archivedAt === undefined && isDueOn(h.frequency, todayKey))
  }, [habits.data, todayKey])

  if (habits.isPending || completions.isPending)
    return <LoadingState variant="inline" label="Loading habits…" />
  if (habits.isError || completions.isError)
    return (
      <ErrorState
        variant="compact"
        error={habits.error ?? completions.error}
        title="Could not load habits"
        onRetry={() => {
          void habits.refetch()
          void completions.refetch()
        }}
      />
    )
  if (dueToday.length === 0)
    return <EmptyState variant="compact" title={EMPTY_STATES.todayHabits.title} />

  const toggle = (habitId: string, checked: boolean): void => {
    setCompletion.mutate({ habitId, date: todayKey, completed: checked })
  }

  return (
    <ul className="flex flex-col" aria-label="Today's habits">
      {dueToday.map((habit) => {
        const stats = calculateHabitStats(
          habit,
          (completions.data ?? []).filter((c) => c.habitId === habit.id),
          todayKey,
          settings.weekStartsOn
        )
        return (
          <li key={habit.id} className="flex min-h-9 items-center justify-between gap-3">
            <label className="flex min-w-0 flex-1 items-center gap-3 py-1.5">
              <Checkbox
                checked={stats.completedToday}
                onCheckedChange={(checked) => toggle(habit.id, checked === true)}
                aria-label={`Mark ${habit.name} done today`}
                className="size-[18px] rounded-full"
              />
              <span
                className={cn(
                  'truncate text-body',
                  stats.completedToday ? 'text-ink-3' : 'text-ink'
                )}
              >
                {habit.name}
              </span>
            </label>
            <span className="tabular flex shrink-0 items-baseline gap-1 text-meta text-ink-3">
              <span>{stats.current}</span>
              <span>{streakUnit(habit, stats.current)}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
