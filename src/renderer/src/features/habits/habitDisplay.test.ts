import { describe, expect, it } from 'vitest'
import type { Habit } from '@shared/types/habit'
import { frequencyLabel, streakUnit, weekProgress } from './habitDisplay'

const habit = (frequency: Habit['frequency']): Habit => ({
  id: 'h',
  name: 'Read',
  color: '#3b82f6',
  frequency,
  createdAt: '2026-01-01T00:00:00.000Z'
})

describe('frequencyLabel', () => {
  it('uses one phrase per concept', () => {
    expect(frequencyLabel(habit({ type: 'daily' }))).toBe('Daily')
    expect(frequencyLabel(habit({ type: 'weekly', targetCount: 3 }))).toBe('3× a week')
    expect(frequencyLabel(habit({ type: 'specific_days', days: [1, 2, 3, 4, 5] }))).toBe(
      'Mon – Fri'
    )
    expect(frequencyLabel(habit({ type: 'specific_days', days: [1, 3, 6] }))).toBe('Mon, Wed, Sat')
    expect(frequencyLabel(habit({ type: 'specific_days', days: [1, 2, 3, 4, 5, 6, 7] }))).toBe(
      'Daily'
    )
  })
})

describe('streakUnit', () => {
  it('counts weeks for a weekly target and days otherwise', () => {
    expect(streakUnit(habit({ type: 'daily' }), 1)).toBe('day')
    expect(streakUnit(habit({ type: 'daily' }), 0)).toBe('days')
    expect(streakUnit(habit({ type: 'weekly', targetCount: 3 }), 2)).toBe('weeks')
  })
})

describe('weekProgress', () => {
  // 2026-11-26 is a Thursday; the week starts on Monday 2026-11-23.
  const done = new Set(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26'])

  it('does not count days that have not happened yet', () => {
    expect(weekProgress(habit({ type: 'daily' }), done, '2026-11-26', 1)).toEqual({
      done: 4,
      target: 4
    })
  })

  it('counts only scheduled days for specific days', () => {
    expect(
      weekProgress(habit({ type: 'specific_days', days: [1, 3, 6] }), done, '2026-11-26', 1)
    ).toEqual({ done: 2, target: 2 })
  })

  it('keeps the target count for a weekly target', () => {
    expect(weekProgress(habit({ type: 'weekly', targetCount: 3 }), done, '2026-11-26', 1)).toEqual({
      done: 3,
      target: 3
    })
  })
})
