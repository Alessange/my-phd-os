import { useMemo } from 'react'
import { addDays, todayInZone } from '@shared/dates'
import { calculateHabitStats, isDueOn } from '@shared/habits/streaks'
import { useHabitCompletions, useHabits } from '@renderer/features/habits/api'
import { useFormat } from '@renderer/hooks/useFormat'
import { useNow } from '@renderer/hooks/useNow'

/** Same window `TodayHabitsCompact` asks for, so both read one cached query. */
const HISTORY_DAYS = 90

/**
 * `4 of 5` for the panel heading: how many of today's due habits are done. `undefined` while the
 * data is loading, failed, or nothing is due today (the section then shows its own line).
 */
export function useTodayHabitsProgress(): { done: number; total: number } | undefined {
  const { zone, settings } = useFormat()
  const nowIso = useNow({ precision: 'minute' })
  const todayKey = todayInZone(zone, nowIso)
  const habits = useHabits()
  const completions = useHabitCompletions({
    from: addDays(todayKey, -(HISTORY_DAYS - 1)),
    to: todayKey
  })
  const habitList = habits.data
  const completionList = completions.data

  return useMemo(() => {
    if (!habitList || !completionList) return undefined
    const due = habitList.filter(
      (h) => h.archivedAt === undefined && isDueOn(h.frequency, todayKey)
    )
    if (due.length === 0) return undefined
    const done = due.filter(
      (habit) =>
        calculateHabitStats(
          habit,
          completionList.filter((c) => c.habitId === habit.id),
          todayKey,
          settings.weekStartsOn
        ).completedToday
    ).length
    return { done, total: due.length }
  }, [habitList, completionList, todayKey, settings.weekStartsOn])
}
