import { describe, expect, it } from 'vitest'
import {
  calculateRemainingTime,
  countdownSegments,
  formatCountdown,
  formatRelative,
  MS_PER_DAY,
  MS_PER_HOUR,
  MS_PER_MINUTE
} from './countdown'

const now = '2026-09-06T12:00:00.000Z'
const plus = (ms: number): string => new Date(Date.parse(now) + ms).toISOString()

describe('calculateRemainingTime', () => {
  it('splits a future duration into days/hours/minutes/seconds', () => {
    const target = plus(32 * MS_PER_DAY + 8 * MS_PER_HOUR + 14 * MS_PER_MINUTE + 9_000)
    expect(calculateRemainingTime(target, now)).toEqual({
      totalMs: 32 * MS_PER_DAY + 8 * MS_PER_HOUR + 14 * MS_PER_MINUTE + 9_000,
      isPast: false,
      isUnder24h: false,
      days: 32,
      hours: 8,
      minutes: 14,
      seconds: 9
    })
  })

  it('flags less than 24 hours remaining', () => {
    expect(calculateRemainingTime(plus(MS_PER_DAY - 1), now).isUnder24h).toBe(true)
    expect(calculateRemainingTime(plus(MS_PER_DAY), now).isUnder24h).toBe(false)
    expect(calculateRemainingTime(plus(-1), now).isUnder24h).toBe(false)
  })

  it('reports past targets with absolute components', () => {
    const remaining = calculateRemainingTime(plus(-(2 * MS_PER_DAY + 3 * MS_PER_HOUR)), now)
    expect(remaining.isPast).toBe(true)
    expect(remaining.totalMs).toBe(-(2 * MS_PER_DAY + 3 * MS_PER_HOUR))
    expect(remaining).toMatchObject({ days: 2, hours: 3, minutes: 0, seconds: 0 })
  })

  it('treats the exact instant as not past', () => {
    const remaining = calculateRemainingTime(now, now)
    expect(remaining.isPast).toBe(false)
    expect(remaining.totalMs).toBe(0)
  })
})

describe('formatCountdown', () => {
  const dayPlus = calculateRemainingTime(
    plus(32 * MS_PER_DAY + 8 * MS_PER_HOUR + 14 * MS_PER_MINUTE),
    now
  )
  const under24h = calculateRemainingTime(plus(8 * MS_PER_HOUR + 14 * MS_PER_MINUTE + 9_000), now)
  const underHour = calculateRemainingTime(plus(14 * MS_PER_MINUTE + 9_000), now)

  it('formats the long style like the spec example', () => {
    expect(formatCountdown(dayPlus, { style: 'long' })).toBe('32 days 08 hours 14 minutes')
    expect(formatCountdown(dayPlus)).toBe('32 days 08 hours 14 minutes')
  })

  it('emphasises hours, minutes and seconds under 24 hours', () => {
    expect(formatCountdown(under24h, { style: 'long' })).toBe('08 hours 14 minutes 09 seconds')
    expect(countdownSegments(under24h).map((s) => s.unit)).toEqual(['hour', 'minute', 'second'])
    expect(formatCountdown(under24h, { style: 'compact' })).toBe('08h 14m')
    expect(formatCountdown(underHour, { style: 'compact' })).toBe('14m 09s')
  })

  it('formats compact and stacked styles', () => {
    expect(formatCountdown(dayPlus, { style: 'compact' })).toBe('32d 08h')
    expect(formatCountdown(dayPlus, { style: 'stacked' })).toBe('32 days\n08 hours\n14 minutes')
  })

  it('uses singular units', () => {
    const one = calculateRemainingTime(plus(MS_PER_DAY + MS_PER_HOUR + MS_PER_MINUTE), now)
    expect(formatCountdown(one)).toBe('1 day 01 hour 01 minute')
  })

  it('formats passed targets', () => {
    expect(formatCountdown(calculateRemainingTime(plus(-2 * MS_PER_DAY), now))).toBe(
      'Passed 2 days ago'
    )
    expect(formatCountdown(calculateRemainingTime(plus(-MS_PER_DAY), now))).toBe('Passed 1 day ago')
    expect(formatCountdown(calculateRemainingTime(plus(-3 * MS_PER_HOUR), now))).toBe(
      'Passed 3 hours ago'
    )
    expect(formatCountdown(calculateRemainingTime(plus(-5 * MS_PER_MINUTE), now))).toBe(
      'Passed 5 minutes ago'
    )
    expect(formatCountdown(calculateRemainingTime(plus(-30_000), now))).toBe('Passed just now')
    expect(
      formatCountdown(calculateRemainingTime(plus(-2 * MS_PER_DAY), now), { style: 'compact' })
    ).toBe('Passed 2d ago')
  })
})

describe('formatRelative', () => {
  it('produces coarse relative phrases', () => {
    expect(formatRelative(plus(3 * MS_PER_DAY + MS_PER_HOUR), now)).toBe('in 3 days')
    expect(formatRelative(plus(5 * MS_PER_HOUR), now)).toBe('in 5 hours')
    expect(formatRelative(plus(12 * MS_PER_MINUTE), now)).toBe('in 12 minutes')
    expect(formatRelative(plus(10_000), now)).toBe('just now')
    expect(formatRelative(plus(-2 * MS_PER_DAY), now)).toBe('2 days ago')
    expect(formatRelative(plus(-MS_PER_MINUTE), now)).toBe('1 minute ago')
  })
})
