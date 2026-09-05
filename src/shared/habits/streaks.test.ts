import { describe, expect, it } from 'vitest'
import { addDays, startOfWeek, todayInZone } from '../dates/allDay'
import type { HabitCompletion, HabitFrequency } from '../types/habit'
import {
  buildCompletionGrid,
  calculateHabitStats,
  calculateHabitStreak,
  calculateLongestStreak,
  isDueOn,
  toCompletedSet,
  weeklyCompletion
} from './streaks'

// 2026-09-04 is a Friday (ISO weekday 5). Aug 31 is Monday, Aug 30 is Sunday.
const TODAY = '2026-09-04'
const MON = 1 as const
const SUN = 0 as const

const daily: HabitFrequency = { type: 'daily' }
const weekly3: HabitFrequency = { type: 'weekly', targetCount: 3 }
const mwf: HabitFrequency = { type: 'specific_days', days: [1, 3, 5] }

const done = (...dates: string[]): HabitCompletion[] =>
  dates.map((date) => ({ id: `${date}@x`, habitId: 'h1', date, completed: true }))

const set = (...dates: string[]): Set<string> => toCompletedSet(done(...dates))

describe('isDueOn', () => {
  it('daily and weekly are due every day', () => {
    expect(isDueOn(daily, TODAY)).toBe(true)
    expect(isDueOn(weekly3, TODAY)).toBe(true)
  })
  it('specific_days is due only on scheduled weekdays', () => {
    // TODAY is Friday (5) → due; Sep 3 Thursday (4) → not due; Sep 2 Wednesday (3) → due
    expect(isDueOn(mwf, TODAY)).toBe(true)
    expect(isDueOn(mwf, '2026-09-03')).toBe(false)
    expect(isDueOn(mwf, '2026-09-02')).toBe(true)
  })
})

describe('startOfWeek', () => {
  it('Monday-start lands on Monday', () => {
    expect(startOfWeek(TODAY, MON)).toBe('2026-08-31')
  })
  it('Sunday-start lands on Sunday', () => {
    expect(startOfWeek(TODAY, SUN)).toBe('2026-08-30')
  })
})

describe('weeklyCompletion', () => {
  it('daily counts completed days out of 7', () => {
    expect(
      weeklyCompletion(daily, set('2026-08-31', '2026-09-01', '2026-09-04'), '2026-08-31')
    ).toEqual({
      done: 3,
      target: 7
    })
  })
  it('specific_days counts completed scheduled days', () => {
    // week Aug 31..Sep 6; scheduled Mon(31)/Wed(2)/Fri(4)
    expect(weeklyCompletion(mwf, set('2026-08-31', '2026-09-02'), '2026-08-31')).toEqual({
      done: 2,
      target: 3
    })
  })
  it('weekly caps done at targetCount', () => {
    expect(
      weeklyCompletion(
        weekly3,
        set('2026-08-31', '2026-09-01', '2026-09-02', '2026-09-04'),
        '2026-08-31'
      )
    ).toEqual({ done: 3, target: 3 })
  })
})

describe('calculateHabitStreak (daily)', () => {
  it('counts consecutive days ending today', () => {
    expect(
      calculateHabitStreak(daily, set('2026-09-02', '2026-09-03', '2026-09-04'), TODAY, MON)
    ).toBe(3)
  })
  it('treats an undone today as pending and continues from yesterday', () => {
    expect(calculateHabitStreak(daily, set('2026-09-02', '2026-09-03'), TODAY, MON)).toBe(2)
  })
  it('breaks at the first missed day', () => {
    expect(calculateHabitStreak(daily, set('2026-09-04', '2026-09-02'), TODAY, MON)).toBe(1)
  })
  it('returns 0 with no completions', () => {
    expect(calculateHabitStreak(daily, set(), TODAY, MON)).toBe(0)
  })
})

describe('calculateHabitStreak (specific_days)', () => {
  it('skips non-scheduled days without breaking the streak', () => {
    // Mon 8/31, Wed 9/2, Fri 9/4 all done → streak 3 (Tue/Thu not due, skipped)
    expect(
      calculateHabitStreak(mwf, set('2026-08-31', '2026-09-02', '2026-09-04'), TODAY, MON)
    ).toBe(3)
  })
  it('breaks when a scheduled day is missed', () => {
    // Only Fri 9/4 done; Wed 9/2 missed → streak 1 (today done, Wed missed)
    expect(calculateHabitStreak(mwf, set('2026-09-04'), TODAY, MON)).toBe(1)
  })
  it('pending today (due but not done) continues from the previous scheduled day', () => {
    // Mon 8/31, Wed 9/2 done; Fri 9/4 (today) not done → pending, streak 2
    expect(calculateHabitStreak(mwf, set('2026-08-31', '2026-09-02'), TODAY, MON)).toBe(2)
  })
})

describe('calculateHabitStreak (weekly)', () => {
  it('counts this week when target is met', () => {
    expect(
      calculateHabitStreak(weekly3, set('2026-08-31', '2026-09-01', '2026-09-02'), TODAY, MON)
    ).toBe(1)
  })
  it('pending this week continues from last week', () => {
    // This week only 1 done (< 3) → pending; last week met
    expect(
      calculateHabitStreak(
        weekly3,
        set('2026-09-04', '2026-08-24', '2026-08-25', '2026-08-26'),
        TODAY,
        MON
      )
    ).toBe(1)
  })
  it('counts consecutive met weeks', () => {
    expect(
      calculateHabitStreak(
        weekly3,
        set(
          '2026-08-24',
          '2026-08-25',
          '2026-08-26', // last week met
          '2026-08-31',
          '2026-09-01',
          '2026-09-02' // this week met
        ),
        TODAY,
        MON
      )
    ).toBe(2)
  })
})

describe('calculateLongestStreak', () => {
  it('finds the longest daily run even with earlier gaps', () => {
    // 8/28 done, 8/29..9/1 missing, then 9/2-9/4 run of 3
    expect(
      calculateLongestStreak(
        daily,
        set('2026-08-28', '2026-09-02', '2026-09-03', '2026-09-04'),
        TODAY,
        MON
      )
    ).toBe(3)
  })
  it('returns 0 with no completions', () => {
    expect(calculateLongestStreak(daily, set(), TODAY, MON)).toBe(0)
  })
  it('finds the longest weekly run', () => {
    // week 8/17 met (3 days), week 8/24 met (3 days), this week met → 3
    expect(
      calculateLongestStreak(
        weekly3,
        set(
          '2026-08-17',
          '2026-08-18',
          '2026-08-19',
          '2026-08-24',
          '2026-08-25',
          '2026-08-26',
          '2026-08-31',
          '2026-09-01',
          '2026-09-02'
        ),
        TODAY,
        MON
      )
    ).toBe(3)
  })
})

describe('calculateHabitStats', () => {
  it('composes current/longest/weekly for a daily habit', () => {
    const stats = calculateHabitStats(
      {
        id: 'h1',
        name: 'Reading',
        color: '#3b82f6',
        frequency: daily,
        createdAt: '2026-08-01T00:00:00.000Z'
      },
      done('2026-09-02', '2026-09-03', '2026-09-04'),
      TODAY,
      MON
    )
    expect(stats).toMatchObject({
      current: 3,
      longest: 3,
      dueToday: true,
      completedToday: true,
      weekDone: 3,
      weekTarget: 7
    })
  })
  it('reports dueToday false for specific_days not scheduled today', () => {
    // Saturday Sep 5 2026 is weekday 6, not in [1,3,5]
    const stats = calculateHabitStats(
      {
        id: 'h1',
        name: 'MWF',
        color: '#3b82f6',
        frequency: mwf,
        createdAt: '2026-08-01T00:00:00.000Z'
      },
      [],
      '2026-09-05',
      MON
    )
    expect(stats.dueToday).toBe(false)
    expect(stats.completedToday).toBe(false)
  })
})

describe('buildCompletionGrid', () => {
  it('produces `weeks` weeks of 7 ordered oldest-first', () => {
    const grid = buildCompletionGrid(set(), TODAY, 2, MON)
    expect(grid).toHaveLength(2)
    for (const week of grid) expect(week.days).toHaveLength(7)
    // oldest week starts 7 days before this week's Monday (2026-08-31)
    expect(grid[0].startKey).toBe('2026-08-24')
    expect(grid[1].startKey).toBe('2026-08-31')
    // this week's Monday is the first day of the newest week
    expect(grid[1].days[0].dateKey).toBe('2026-08-31')
  })
  it('marks future days and completed days', () => {
    const grid = buildCompletionGrid(set('2026-09-04'), TODAY, 1, MON)
    const todayCell = grid[0].days.find((c) => c.dateKey === TODAY)
    const futureCell = grid[0].days.find((c) => c.dateKey === addDays(TODAY, 1))
    expect(todayCell?.completed).toBe(true)
    expect(todayCell?.future).toBe(false)
    expect(futureCell?.future).toBe(true)
    expect(futureCell?.completed).toBe(false)
  })
  it('orders days by Sunday-start when configured', () => {
    const grid = buildCompletionGrid(set(), TODAY, 1, SUN)
    expect(grid[0].startKey).toBe('2026-08-30') // Sunday
    expect(grid[0].days[0].dateKey).toBe('2026-08-30')
  })
})

describe('timezone boundary', () => {
  it('scores completions on the local date even after UTC has rolled over to the next day', () => {
    // 23:30 on Sep 4 in Vancouver is already 06:30 on Sep 5 in UTC.
    const lateEvening = '2026-09-05T06:30:00.000Z'
    const vancouverToday = todayInZone('America/Vancouver', lateEvening)
    expect(vancouverToday).toBe('2026-09-04')
    // Locally it is still Sep 4: today is done, streak is 2.
    expect(calculateHabitStreak(daily, set('2026-09-03', '2026-09-04'), vancouverToday, MON)).toBe(
      2
    )
    // Seen from UTC the day is Sep 5, which is pending; the streak still continues from Sep 4.
    const utcToday = todayInZone('UTC', lateEvening)
    expect(utcToday).toBe('2026-09-05')
    expect(calculateHabitStreak(daily, set('2026-09-03', '2026-09-04'), utcToday, MON)).toBe(2)
  })
})
