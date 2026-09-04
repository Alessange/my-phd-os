import { describe, expect, it } from 'vitest'
import { AppError } from '../errors'
import {
  addDays,
  compareDateKeys,
  dateKeyInZone,
  diffDays,
  isAllDayDate,
  startOfDayInZone,
  todayInZone,
  weekdayOfDate
} from './allDay'

describe('isAllDayDate', () => {
  it('accepts real YYYY-MM-DD dates only', () => {
    expect(isAllDayDate('2026-09-18')).toBe(true)
    expect(isAllDayDate('2026-02-29')).toBe(false)
    expect(isAllDayDate('2028-02-29')).toBe(true)
    expect(isAllDayDate('2026-09-18T00:00:00Z')).toBe(false)
    expect(isAllDayDate('20260918')).toBe(false)
    expect(isAllDayDate('')).toBe(false)
  })
})

describe('addDays / diffDays', () => {
  it('does pure calendar arithmetic across month, year and DST boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09')
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(diffDays('2026-09-01', '2026-09-18')).toBe(17)
    expect(diffDays('2026-09-18', '2026-09-01')).toBe(-17)
  })

  it('rejects invalid keys', () => {
    expect(() => addDays('2026-13-01', 1)).toThrow(AppError)
  })
})

describe('all-day dates never shift through zones', () => {
  it('keeps the same date string regardless of the display zone', () => {
    const date = '2026-09-18'
    for (const zone of ['AoE', 'PT', 'Asia/Tokyo', 'UTC+14', 'UTC-12:00']) {
      expect(startOfDayInZone(date, zone).length).toBeGreaterThan(0)
      expect(addDays(date, 0)).toBe(date)
      // The local day starts at midnight in that zone and its date key is unchanged.
      expect(dateKeyInZone(startOfDayInZone(date, zone), zone)).toBe(date)
    }
  })

  it('computes midnight instants per zone', () => {
    expect(startOfDayInZone('2026-09-18', 'UTC')).toBe('2026-09-18T00:00:00.000Z')
    expect(startOfDayInZone('2026-09-18', 'AoE')).toBe('2026-09-18T12:00:00.000Z')
    expect(startOfDayInZone('2026-09-18', 'PT')).toBe('2026-09-18T07:00:00.000Z')
    expect(startOfDayInZone('2026-01-18', 'PT')).toBe('2026-01-18T08:00:00.000Z')
  })
})

describe('dateKeyInZone / todayInZone', () => {
  const instant = '2026-09-19T11:59:00.000Z'

  it('returns the local calendar date for an instant', () => {
    expect(dateKeyInZone(instant, 'AoE')).toBe('2026-09-18')
    expect(dateKeyInZone(instant, 'PT')).toBe('2026-09-19')
    expect(dateKeyInZone(instant, 'Asia/Tokyo')).toBe('2026-09-19')
    expect(dateKeyInZone('2026-09-19T15:30:00Z', 'Pacific/Auckland')).toBe('2026-09-20')
  })

  it('todayInZone mirrors dateKeyInZone', () => {
    expect(todayInZone('AoE', instant)).toBe('2026-09-18')
    expect(todayInZone('UTC', instant)).toBe('2026-09-19')
  })
})

describe('weekdayOfDate / compareDateKeys', () => {
  it('uses ISO weekdays', () => {
    expect(weekdayOfDate('2026-09-18')).toBe(5) // Friday
    expect(weekdayOfDate('2026-09-20')).toBe(7) // Sunday
    expect(weekdayOfDate('2026-09-21')).toBe(1) // Monday
  })

  it('compares lexicographically', () => {
    expect(compareDateKeys('2026-09-18', '2026-09-19')).toBe(-1)
    expect(compareDateKeys('2026-09-18', '2026-09-18')).toBe(0)
    expect(compareDateKeys('2026-10-01', '2026-09-30')).toBe(1)
  })
})
