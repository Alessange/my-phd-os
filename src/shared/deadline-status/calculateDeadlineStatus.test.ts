import { describe, expect, it } from 'vitest'
import { MS_PER_HOUR } from '../dates/countdown'
import type { DeadlineStatusInput } from './calculateDeadlineStatus'
import { calculateDeadlineStatus } from './calculateDeadlineStatus'
import { DEADLINE_STATUS_THRESHOLDS } from './config'

// A 10-day tracking window; "now" is placed at 50 % elapsed unless a test says otherwise.
const trackingStartAt = '2026-09-01T00:00:00.000Z'
const deadlineAt = '2026-09-11T00:00:00.000Z'
const halfway = '2026-09-06T00:00:00.000Z'

const deadline = (overrides: Partial<DeadlineStatusInput> = {}): DeadlineStatusInput => ({
  trackingStartAt,
  deadlineAt,
  progress: 50,
  status: 'in_progress',
  ...overrides
})

const statusAt = (progress: number, now = halfway): string =>
  calculateDeadlineStatus(deadline({ progress }), now).status

describe('calculateDeadlineStatus — thresholds', () => {
  it('exposes the spec thresholds in one place', () => {
    expect(DEADLINE_STATUS_THRESHOLDS).toEqual({
      URGENT_WINDOW_HOURS: 24,
      URGENT_PROGRESS_CEILING: 90,
      AT_RISK_GAP: 20,
      BEHIND_GAP: 8,
      AHEAD_GAP: 10
    })
  })
})

describe('calculateDeadlineStatus — rule order', () => {
  it('Completed overrides everything, including overdue and urgent', () => {
    const overdueNow = '2026-09-20T00:00:00.000Z'
    expect(
      calculateDeadlineStatus(deadline({ status: 'completed', progress: 10 }), overdueNow).status
    ).toBe('completed')
    const urgentNow = new Date(Date.parse(deadlineAt) - MS_PER_HOUR).toISOString()
    expect(
      calculateDeadlineStatus(deadline({ status: 'completed', progress: 0 }), urgentNow).status
    ).toBe('completed')
    expect(
      calculateDeadlineStatus(deadline({ status: 'completed', progress: 100 }), halfway).status
    ).toBe('completed')
  })

  it('Overdue overrides urgent, at-risk and ahead once now is past the deadline', () => {
    const justAfter = new Date(Date.parse(deadlineAt) + 1).toISOString()
    expect(calculateDeadlineStatus(deadline({ progress: 0 }), justAfter).status).toBe('overdue')
    expect(calculateDeadlineStatus(deadline({ progress: 99 }), justAfter).status).toBe('overdue')
    expect(
      calculateDeadlineStatus(deadline({ progress: 100, status: 'in_progress' }), justAfter).status
    ).toBe('overdue')
    // A 'missed' stored status does not short-circuit: rules run on time and progress.
    expect(
      calculateDeadlineStatus(deadline({ status: 'missed', progress: 0 }), justAfter).status
    ).toBe('overdue')
  })

  it('is not overdue at the exact deadline instant (now > deadline is strict)', () => {
    const result = calculateDeadlineStatus(deadline({ progress: 95 }), deadlineAt)
    expect(result.status).not.toBe('overdue')
    expect(result.remaining.isPast).toBe(false)
  })

  it('Urgent when under 24 hours remain and progress < 90', () => {
    const in23h = new Date(Date.parse(deadlineAt) - 23 * MS_PER_HOUR).toISOString()
    expect(statusAt(0, in23h)).toBe('urgent')
    expect(statusAt(89.99, in23h)).toBe('urgent')
    // At the ceiling, urgent no longer applies; time progress is ~90.4 % here so 90 % work is on track.
    expect(statusAt(90, in23h)).toBe('on_track')
    expect(statusAt(100, in23h)).toBe('on_track')
  })

  it('Urgent boundary at exactly 24 hours remaining', () => {
    const exactly24h = new Date(Date.parse(deadlineAt) - 24 * MS_PER_HOUR).toISOString()
    const justUnder24h = new Date(Date.parse(deadlineAt) - 24 * MS_PER_HOUR + 1).toISOString()
    // 24 h left is not "< 24 hours"; time progress is 90 %, so 0 % work is at risk.
    expect(statusAt(0, exactly24h)).toBe('at_risk')
    expect(statusAt(0, justUnder24h)).toBe('urgent')
  })

  it('Urgent takes precedence over at-risk/behind/ahead when in the window', () => {
    const in1h = new Date(Date.parse(deadlineAt) - MS_PER_HOUR).toISOString()
    expect(statusAt(10, in1h)).toBe('urgent')
    expect(statusAt(85, in1h)).toBe('urgent')
  })

  it('At Risk when progress < timeProgress − 20 (strict)', () => {
    // timeProgress = 50 % at halfway
    expect(statusAt(29.99)).toBe('at_risk')
    expect(statusAt(0)).toBe('at_risk')
    expect(statusAt(30)).toBe('behind') // exactly at the boundary is not at risk
  })

  it('Behind when progress < timeProgress − 8 (strict)', () => {
    expect(statusAt(41.99)).toBe('behind')
    expect(statusAt(30)).toBe('behind')
    expect(statusAt(42)).toBe('on_track') // exactly at the boundary is on track
  })

  it('Ahead when progress > timeProgress + 10 (strict)', () => {
    expect(statusAt(60.01)).toBe('ahead')
    expect(statusAt(100)).toBe('ahead')
    expect(statusAt(60)).toBe('on_track') // exactly at the boundary is on track
  })

  it('On Track inside the band', () => {
    expect(statusAt(42)).toBe('on_track')
    expect(statusAt(50)).toBe('on_track')
    expect(statusAt(60)).toBe('on_track')
  })
})

describe('calculateDeadlineStatus — derived values', () => {
  it('returns time progress, pace difference and remaining time', () => {
    const result = calculateDeadlineStatus(deadline({ progress: 65 }), halfway)
    expect(result.timeProgress).toEqual({ raw: 0.5, clamped: 0.5 })
    expect(result.paceDifference).toBe(15)
    expect(result.remaining.days).toBe(5)
    expect(result.remaining.isPast).toBe(false)
    expect(result.status).toBe('ahead')
  })

  it('clamps time progress when overdue while keeping the raw ratio', () => {
    const result = calculateDeadlineStatus(deadline({ progress: 40 }), '2026-09-21T00:00:00.000Z')
    expect(result.status).toBe('overdue')
    expect(result.timeProgress.raw).toBeCloseTo(2)
    expect(result.timeProgress.clamped).toBe(1)
    expect(result.paceDifference).toBe(-60)
    expect(result.remaining.isPast).toBe(true)
  })

  it('handles tracking start equal to deadline: time progress 1, urgent before, overdue after', () => {
    const same = deadline({ trackingStartAt: deadlineAt, deadlineAt, progress: 20 })
    const before = calculateDeadlineStatus(
      same,
      new Date(Date.parse(deadlineAt) - MS_PER_HOUR).toISOString()
    )
    expect(before.timeProgress).toEqual({ raw: 1, clamped: 1 })
    expect(before.paceDifference).toBe(-80)
    expect(before.status).toBe('urgent')

    const farBefore = calculateDeadlineStatus(same, '2026-09-01T00:00:00.000Z')
    expect(farBefore.timeProgress.clamped).toBe(1)
    expect(farBefore.status).toBe('at_risk')

    const after = calculateDeadlineStatus(same, new Date(Date.parse(deadlineAt) + 1).toISOString())
    expect(after.status).toBe('overdue')
  })

  it('before the tracking start, time progress is 0 and generous progress reads as ahead', () => {
    const early = calculateDeadlineStatus(deadline({ progress: 20 }), '2026-08-01T00:00:00.000Z')
    expect(early.timeProgress.clamped).toBe(0)
    expect(early.timeProgress.raw).toBeLessThan(0)
    expect(early.status).toBe('ahead')
    expect(
      calculateDeadlineStatus(deadline({ progress: 0 }), '2026-08-01T00:00:00.000Z').status
    ).toBe('on_track')
  })

  it('accepts custom thresholds', () => {
    const relaxed = { ...DEADLINE_STATUS_THRESHOLDS, AT_RISK_GAP: 40, BEHIND_GAP: 30 }
    expect(calculateDeadlineStatus(deadline({ progress: 25 }), halfway, relaxed).status).toBe(
      'on_track'
    )
  })
})
