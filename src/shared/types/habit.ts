import type { IsoDate, IsoInstant } from './common'

export type HabitFrequency =
  | { type: 'daily' }
  | { type: 'weekly'; targetCount: number }
  /** `days` are ISO weekday numbers 1 (Monday) … 7 (Sunday). */
  | { type: 'specific_days'; days: number[] }

export type HabitFrequencyType = HabitFrequency['type']

export interface Habit {
  id: string
  name: string
  color: string
  icon?: string

  frequency: HabitFrequency

  createdAt: IsoInstant
  archivedAt?: IsoInstant
}

export interface HabitCompletion {
  id: string
  habitId: string
  /** Local calendar date (`YYYY-MM-DD`) in the application timezone at completion time. */
  date: IsoDate
  completed: boolean
}
