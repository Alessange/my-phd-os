import { addDays, compareDateKeys, startOfWeek, weekdayOfDate } from '../dates/allDay'
import type { Habit, HabitCompletion, HabitFrequency } from '../types/habit'

/**
 * Pure habit statistics (spec §16, §21: "Keep business calculations independent from UI
 * components"). A "due day" is a day the habit is scheduled: every day for `daily`/`weekly`, or the
 * configured weekdays for `specific_days`. Streaks count consecutive *scheduled* days, so a
 * `specific_days` habit does not break its streak on non-scheduled days.
 */

export interface HabitStats {
  /** Consecutive completed due days (or met weeks) ending today — today is "pending" if due but not yet done. */
  current: number
  /** Longest such run over all recorded completions. */
  longest: number
  dueToday: boolean
  completedToday: boolean
  /** Completed scheduled days this week (capped at target). */
  weekDone: number
  /** Scheduled days this week (daily=7, specific_days=its weekdays, weekly=targetCount). */
  weekTarget: number
}

export interface CompletionCell {
  dateKey: string
  completed: boolean
  future: boolean
}

export interface CompletionWeek {
  startKey: string
  days: CompletionCell[]
}

/** Upper bound on day/week walks so a bug can never hang the renderer. ~12 years. */
const DAY_CAP = 365 * 12

export const toCompletedSet = (completions: readonly HabitCompletion[]): Set<string> => {
  const set = new Set<string>()
  for (const c of completions) if (c.completed) set.add(c.date)
  return set
}

/** Is the habit scheduled on this local date? `weekly` and `daily` are due every day. */
export const isDueOn = (frequency: HabitFrequency, dateKey: string): boolean => {
  if (frequency.type === 'daily' || frequency.type === 'weekly') return true
  return frequency.days.includes(weekdayOfDate(dateKey))
}

/** Scheduled days per full week: 7 (daily), the weekday count (specific_days), or targetCount (weekly). */
export const weeklyTarget = (frequency: HabitFrequency): number =>
  frequency.type === 'weekly'
    ? frequency.targetCount
    : frequency.type === 'daily'
      ? 7
      : frequency.days.length

const countCompletedDueInRange = (
  frequency: HabitFrequency,
  set: Set<string>,
  from: string,
  to: string
): number => {
  let n = 0
  let d = from
  let guard = 0
  while (compareDateKeys(d, to) <= 0 && guard++ < DAY_CAP) {
    if (isDueOn(frequency, d) && set.has(d)) n++
    d = addDays(d, 1)
  }
  return n
}

/** Completed scheduled days in the week starting `weekStartKey`, capped at the weekly target. */
export const weeklyCompletion = (
  frequency: HabitFrequency,
  completedSet: Set<string>,
  weekStartKey: string
): { done: number; target: number } => {
  const target = weeklyTarget(frequency)
  const weekEnd = addDays(weekStartKey, 6)
  const done = Math.min(
    countCompletedDueInRange(frequency, completedSet, weekStartKey, weekEnd),
    target
  )
  return { done, target }
}

const earliestDate = (set: Set<string>): string | undefined => {
  let earliest: string | undefined
  for (const d of set) if (earliest === undefined || d < earliest) earliest = d
  return earliest
}

/** Current streak: consecutive completed due days ending today. If today is due but not yet done, today is pending and the streak continues from yesterday. */
const dailyStreak = (frequency: HabitFrequency, set: Set<string>, todayKey: string): number => {
  let streak = 0
  let d = todayKey
  if (isDueOn(frequency, d) && !set.has(d)) d = addDays(d, -1)
  let guard = 0
  while (guard++ < DAY_CAP) {
    if (isDueOn(frequency, d)) {
      if (set.has(d)) streak++
      else break
    }
    d = addDays(d, -1)
  }
  return streak
}

/** Current streak for a weekly target: consecutive weeks meeting targetCount, ending this week (pending if not yet met). */
const weeklyStreak = (
  frequency: Extract<HabitFrequency, { type: 'weekly' }>,
  set: Set<string>,
  todayKey: string,
  weekStartsOn: 0 | 1
): number => {
  const target = frequency.targetCount
  let streak = 0
  let w = startOfWeek(todayKey, weekStartsOn)
  if (weeklyCompletion(frequency, set, w).done < target) w = addDays(w, -7)
  let guard = 0
  while (guard++ < DAY_CAP) {
    if (weeklyCompletion(frequency, set, w).done >= target) streak++
    else break
    w = addDays(w, -7)
  }
  return streak
}

export const calculateHabitStreak = (
  frequency: HabitFrequency,
  completedSet: Set<string>,
  todayKey: string,
  weekStartsOn: 0 | 1
): number =>
  frequency.type === 'weekly'
    ? weeklyStreak(frequency, completedSet, todayKey, weekStartsOn)
    : dailyStreak(frequency, completedSet, todayKey)

/** Longest run of consecutive completed due days over the recorded range. */
const longestDailyStreak = (
  frequency: HabitFrequency,
  set: Set<string>,
  todayKey: string
): number => {
  const earliest = earliestDate(set)
  if (earliest === undefined) return 0
  let longest = 0
  let run = 0
  let d = earliest
  let guard = 0
  while (compareDateKeys(d, todayKey) <= 0 && guard++ < DAY_CAP) {
    if (isDueOn(frequency, d)) {
      if (set.has(d)) {
        run++
        if (run > longest) longest = run
      } else run = 0
    }
    d = addDays(d, 1)
  }
  return longest
}

const longestWeeklyStreak = (
  frequency: Extract<HabitFrequency, { type: 'weekly' }>,
  set: Set<string>,
  todayKey: string,
  weekStartsOn: 0 | 1
): number => {
  const earliest = earliestDate(set)
  if (earliest === undefined) return 0
  let w = startOfWeek(earliest, weekStartsOn)
  const thisWeek = startOfWeek(todayKey, weekStartsOn)
  let longest = 0
  let run = 0
  let guard = 0
  while (compareDateKeys(w, thisWeek) <= 0 && guard++ < DAY_CAP) {
    if (weeklyCompletion(frequency, set, w).done >= weeklyTarget(frequency)) {
      run++
      if (run > longest) longest = run
    } else run = 0
    w = addDays(w, 7)
  }
  return longest
}

export const calculateLongestStreak = (
  frequency: HabitFrequency,
  completedSet: Set<string>,
  todayKey: string,
  weekStartsOn: 0 | 1
): number =>
  frequency.type === 'weekly'
    ? longestWeeklyStreak(frequency, completedSet, todayKey, weekStartsOn)
    : longestDailyStreak(frequency, completedSet, todayKey)

export const calculateHabitStats = (
  habit: Habit,
  completions: readonly HabitCompletion[],
  todayKey: string,
  weekStartsOn: 0 | 1
): HabitStats => {
  const set = toCompletedSet(completions)
  const weekStart = startOfWeek(todayKey, weekStartsOn)
  const { done, target } = weeklyCompletion(habit.frequency, set, weekStart)
  return {
    current: calculateHabitStreak(habit.frequency, set, todayKey, weekStartsOn),
    longest: calculateLongestStreak(habit.frequency, set, todayKey, weekStartsOn),
    dueToday: isDueOn(habit.frequency, todayKey),
    completedToday: isDueOn(habit.frequency, todayKey) && set.has(todayKey),
    weekDone: done,
    weekTarget: target
  }
}

/**
 * Last `weeks` weeks (oldest first) as a 7-day grid ordered by `weekStartsOn`. Each cell knows whether
 * it was completed and whether it lies in the future (unscored). Used for the calendar-style heatmap.
 */
export const buildCompletionGrid = (
  completedSet: Set<string>,
  todayKey: string,
  weeks: number,
  weekStartsOn: 0 | 1
): CompletionWeek[] => {
  const grid: CompletionWeek[] = []
  let w = addDays(startOfWeek(todayKey, weekStartsOn), -(weeks - 1) * 7)
  for (let i = 0; i < weeks; i++) {
    const days: CompletionCell[] = []
    for (let di = 0; di < 7; di++) {
      const dateKey = addDays(w, di)
      days.push({
        dateKey,
        completed: completedSet.has(dateKey),
        future: compareDateKeys(todayKey, dateKey) < 0
      })
    }
    grid.push({ startKey: w, days })
    w = addDays(w, 7)
  }
  return grid
}
