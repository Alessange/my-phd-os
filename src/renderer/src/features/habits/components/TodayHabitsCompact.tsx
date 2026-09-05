import { Flame, Repeat } from 'lucide-react'
import { useMemo } from 'react'
import { EMPTY_STATES } from '@shared/constants/emptyStates'
import { addDays, todayInZone } from '@shared/dates'
import { calculateHabitStats, isDueOn } from '@shared/habits/streaks'
import { DynamicIcon } from '@renderer/components/common/DynamicIcon'
import { EmptyState } from '@renderer/components/common/EmptyState'
import { ErrorState } from '@renderer/components/common/ErrorState'
import { LoadingState } from '@renderer/components/common/LoadingState'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { useFormat } from '@renderer/hooks/useFormat'
import { useNow } from '@renderer/hooks/useNow'
import { cn } from '@renderer/lib/utils'
import { useHabitCompletions, useHabits, useSetCompletion } from '../api'

const HISTORY_DAYS = 90

/**
 * Today's due habits with a completion toggle and the current streak (Calendar right panel and the
 * Habits page). Compact empty state when there are no habits or none are scheduled today.
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
    return <EmptyState variant="compact" icon={Repeat} title={EMPTY_STATES.todayHabits.title} />

  const toggle = (habitId: string, checked: boolean): void => {
    setCompletion.mutate({ habitId, date: todayKey, completed: checked })
  }

  return (
    <ul className="flex flex-col gap-1.5" aria-label="Today's habits">
      {dueToday.map((habit) => {
        const stats = calculateHabitStats(
          habit,
          (completions.data ?? []).filter((c) => c.habitId === habit.id),
          todayKey,
          settings.weekStartsOn
        )
        return (
          <li
            key={habit.id}
            className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 hover:bg-accent"
          >
            <label className="flex min-w-0 flex-1 items-center gap-2">
              <Checkbox
                checked={stats.completedToday}
                onCheckedChange={(checked) => toggle(habit.id, checked === true)}
                aria-label={`Mark ${habit.name} done today`}
              />
              <span
                className="flex size-4 shrink-0 items-center justify-center rounded text-white"
                style={{ backgroundColor: habit.color }}
              >
                {habit.icon && <DynamicIcon name={habit.icon} className="size-2.5" />}
              </span>
              <span
                className={cn(
                  'truncate text-[13px]',
                  stats.completedToday && 'text-muted-foreground line-through'
                )}
              >
                {habit.name}
              </span>
            </label>
            <span className="tabular flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <Flame className="size-3 text-priority-high" aria-hidden="true" />
              {stats.current}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
