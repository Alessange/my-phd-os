import { addDays, compareDateKeys, startOfWeek } from '@shared/dates'
import { isDueOn } from '@shared/habits/streaks'
import type { Habit } from '@shared/types/habit'

/**
 * Days of completions fetched for streaks and the grid. Streaks are computed from the fetched
 * window, so it is well over a year: a long streak is shown in full. The Habits page and the
 * Calendar panel use the same value so they share one cached query.
 */
export const HISTORY_DAYS = 400

/** Weeks shown in the completion grid. */
export const HEATMAP_WEEKS = 10

export const WD_SHORT: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun'
}

/** One phrase per concept: `Daily`, `3× a week`, `Mon – Fri`, `Mon, Wed, Sat`. */
export const frequencyLabel = (habit: Habit): string => {
  const f = habit.frequency
  if (f.type === 'daily') return 'Daily'
  if (f.type === 'weekly') return `${f.targetCount}× a week`
  const days = [...f.days].sort((a, b) => a - b)
  if (days.length === 7) return 'Daily'
  const first = days[0]
  const last = days[days.length - 1]
  if (
    days.length >= 3 &&
    first !== undefined &&
    last !== undefined &&
    last - first + 1 === days.length
  ) {
    return `${WD_SHORT[first]} – ${WD_SHORT[last]}`
  }
  return days.map((d) => WD_SHORT[d] ?? String(d)).join(', ')
}

/** The streak is counted in weeks for a weekly target and in days otherwise. */
export const streakUnit = (habit: Habit, count: number): string => {
  const word = habit.frequency.type === 'weekly' ? 'week' : 'day'
  return count === 1 ? word : `${word}s`
}

export interface WeekProgress {
  done: number
  /** Scheduled days from the start of the week up to today (weekly target: its target count). */
  target: number
}

/**
 * This week's progress without counting days that have not happened yet, so a perfect Thursday
 * reads `4 of 4`, not 57 %. A weekly target keeps its target count.
 */
export const weekProgress = (
  habit: Habit,
  completedSet: ReadonlySet<string>,
  todayKey: string,
  weekStartsOn: 0 | 1
): WeekProgress => {
  const start = startOfWeek(todayKey, weekStartsOn)
  let done = 0
  let due = 0
  for (let d = start; compareDateKeys(d, todayKey) <= 0; d = addDays(d, 1)) {
    if (!isDueOn(habit.frequency, d)) continue
    due++
    if (completedSet.has(d)) done++
  }
  if (habit.frequency.type === 'weekly') {
    return {
      done: Math.min(done, habit.frequency.targetCount),
      target: habit.frequency.targetCount
    }
  }
  return { done, target: due }
}
