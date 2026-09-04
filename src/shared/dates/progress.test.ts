import { describe, expect, it } from 'vitest'
import { calculatePaceDifference, calculateTimeProgress } from './progress'

const start = '2026-09-01T00:00:00.000Z'
const deadline = '2026-09-11T00:00:00.000Z'

describe('calculateTimeProgress', () => {
  it('is 0 at the tracking start and 1 at the deadline', () => {
    expect(calculateTimeProgress(start, deadline, start)).toEqual({ raw: 0, clamped: 0 })
    expect(calculateTimeProgress(start, deadline, deadline)).toEqual({ raw: 1, clamped: 1 })
  })

  it('is proportional in between', () => {
    expect(calculateTimeProgress(start, deadline, '2026-09-03T12:00:00.000Z').raw).toBeCloseTo(0.25)
    expect(calculateTimeProgress(start, deadline, '2026-09-06T00:00:00.000Z').clamped).toBeCloseTo(
      0.5
    )
  })

  it('clamps beyond the deadline while preserving the raw ratio', () => {
    const result = calculateTimeProgress(start, deadline, '2026-09-16T00:00:00.000Z')
    expect(result.raw).toBeCloseTo(1.5)
    expect(result.clamped).toBe(1)
  })

  it('clamps before the tracking start', () => {
    const result = calculateTimeProgress(start, deadline, '2026-08-31T00:00:00.000Z')
    expect(result.raw).toBeCloseTo(-0.1)
    expect(result.clamped).toBe(0)
  })

  it('yields 1 when the tracking start equals the deadline', () => {
    expect(calculateTimeProgress(deadline, deadline, start)).toEqual({ raw: 1, clamped: 1 })
    expect(calculateTimeProgress(deadline, deadline, deadline)).toEqual({ raw: 1, clamped: 1 })
    expect(calculateTimeProgress(deadline, deadline, '2027-01-01T00:00:00Z')).toEqual({
      raw: 1,
      clamped: 1
    })
  })

  it('yields 1 when the tracking start is after the deadline', () => {
    expect(calculateTimeProgress(deadline, start, '2026-09-05T00:00:00Z')).toEqual({
      raw: 1,
      clamped: 1
    })
  })
})

describe('calculatePaceDifference', () => {
  it('returns work minus time progress in percentage points', () => {
    expect(calculatePaceDifference(60, 0.5)).toBe(10)
    expect(calculatePaceDifference(30, 0.5)).toBe(-20)
    expect(calculatePaceDifference(0, 0)).toBe(0)
    expect(calculatePaceDifference(100, 1)).toBe(0)
    expect(calculatePaceDifference(0, 1)).toBe(-100)
  })
})
