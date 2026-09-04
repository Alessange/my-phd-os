import { describe, expect, it } from 'vitest'
import { AppError } from '../errors'
import {
  compareInstants,
  instantToWallTime,
  isValidInstant,
  nowIso,
  parseInstant,
  wallTimeToInstant
} from './instant'

describe('wallTimeToInstant', () => {
  it('interprets AoE wall time as UTC−12', () => {
    expect(wallTimeToInstant('2026-09-18T23:59:00', 'AoE')).toBe('2026-09-19T11:59:00.000Z')
    expect(wallTimeToInstant('2026-09-18T23:59', 'UTC-12:00')).toBe('2026-09-19T11:59:00.000Z')
  })

  it('handles PT across the March 2026 spring-forward transition', () => {
    // 2026-03-08 02:00 PST → 03:00 PDT
    expect(wallTimeToInstant('2026-03-07T23:59:00', 'PT')).toBe('2026-03-08T07:59:00.000Z') // PST −8
    expect(wallTimeToInstant('2026-03-08T23:59:00', 'PT')).toBe('2026-03-09T06:59:00.000Z') // PDT −7
    // nonexistent 02:30 is shifted forward to 03:30 PDT
    expect(wallTimeToInstant('2026-03-08T02:30:00', 'PT')).toBe('2026-03-08T10:30:00.000Z')
  })

  it('handles PT across the November 2026 fall-back transition', () => {
    // 2026-11-01 02:00 PDT → 01:00 PST
    expect(wallTimeToInstant('2026-10-31T23:59:00', 'PT')).toBe('2026-11-01T06:59:00.000Z') // PDT −7
    expect(wallTimeToInstant('2026-11-01T23:59:00', 'PT')).toBe('2026-11-02T07:59:00.000Z') // PST −8
    // ambiguous 01:30 resolves to the earlier (PDT) offset
    expect(wallTimeToInstant('2026-11-01T01:30:00', 'PT')).toBe('2026-11-01T08:30:00.000Z')
  })

  it('does not treat PT as a fixed UTC−8 offset', () => {
    expect(wallTimeToInstant('2026-07-01T12:00:00', 'PT')).not.toBe(
      wallTimeToInstant('2026-07-01T12:00:00', 'UTC-8')
    )
    expect(wallTimeToInstant('2026-07-01T12:00:00', 'PT')).toBe(
      wallTimeToInstant('2026-07-01T12:00:00', 'UTC-7')
    )
  })

  it('applies fixed offsets exactly', () => {
    expect(wallTimeToInstant('2026-09-18T12:00:00', 'UTC+5:30')).toBe('2026-09-18T06:30:00.000Z')
    expect(wallTimeToInstant('2026-09-18T12:00:00', 'GMT+8')).toBe('2026-09-18T04:00:00.000Z')
    expect(wallTimeToInstant('2026-09-18T12:00:00', 'UTC')).toBe('2026-09-18T12:00:00.000Z')
  })

  it('keeps an explicit offset as an absolute instant', () => {
    expect(wallTimeToInstant('2026-09-18T12:00:00Z', 'PT')).toBe('2026-09-18T12:00:00.000Z')
    expect(wallTimeToInstant('2026-09-18T12:00:00+02:00', 'AoE')).toBe('2026-09-18T10:00:00.000Z')
  })

  it('rejects invalid wall times and zones', () => {
    expect(() => wallTimeToInstant('not a date', 'PT')).toThrow(AppError)
    expect(() => wallTimeToInstant('2026-02-30T10:00:00', 'PT')).toThrow(AppError)
    expect(() => wallTimeToInstant('2026-09-18T10:00:00', 'Nowhere/Land')).toThrow(AppError)
  })
})

describe('instantToWallTime', () => {
  const instant = '2026-09-19T11:59:00.000Z'

  it('shows AoE source time and PDT local time for the same instant (spec §18 example)', () => {
    expect(instantToWallTime(instant, 'AoE')).toEqual({
      localIso: '2026-09-18T23:59:00',
      date: '2026-09-18',
      time: '23:59',
      offsetMinutes: -720,
      zoneLabel: 'AoE'
    })
    expect(instantToWallTime(instant, 'PT')).toEqual({
      localIso: '2026-09-19T04:59:00',
      date: '2026-09-19',
      time: '04:59',
      offsetMinutes: -420,
      zoneLabel: 'PDT'
    })
  })

  it('labels PT as PST in winter and PDT in summer', () => {
    expect(instantToWallTime('2026-01-15T12:00:00Z', 'America/Los_Angeles').zoneLabel).toBe('PST')
    expect(instantToWallTime('2026-07-15T12:00:00Z', 'America/Los_Angeles').zoneLabel).toBe('PDT')
    expect(instantToWallTime('2026-03-08T09:59:00Z', 'PT')).toMatchObject({
      time: '01:59',
      zoneLabel: 'PST'
    })
    expect(instantToWallTime('2026-03-08T10:00:00Z', 'PT')).toMatchObject({
      time: '03:00',
      zoneLabel: 'PDT'
    })
    expect(instantToWallTime('2026-11-01T08:59:00Z', 'PT')).toMatchObject({
      time: '01:59',
      zoneLabel: 'PDT'
    })
    expect(instantToWallTime('2026-11-01T09:00:00Z', 'PT')).toMatchObject({
      time: '01:00',
      zoneLabel: 'PST'
    })
  })

  it('labels fixed offsets and UTC', () => {
    expect(instantToWallTime(instant, 'UTC-8').zoneLabel).toBe('UTC-08:00')
    expect(instantToWallTime(instant, 'UTC+5:30')).toMatchObject({
      time: '17:29',
      zoneLabel: 'UTC+05:30'
    })
    expect(instantToWallTime(instant, 'UTC').zoneLabel).toBe('UTC')
  })

  it('round-trips through wallTimeToInstant', () => {
    for (const zone of ['AoE', 'PT', 'Asia/Tokyo', 'UTC+5:30', 'UTC']) {
      const wall = instantToWallTime(instant, zone)
      expect(wallTimeToInstant(wall.localIso, zone)).toBe(instant)
    }
  })
})

describe('parseInstant / helpers', () => {
  it('validates instants', () => {
    expect(isValidInstant('2026-09-18T11:59:00.000Z')).toBe(true)
    expect(isValidInstant('garbage')).toBe(false)
    expect(() => parseInstant('garbage')).toThrow(AppError)
  })

  it('compares instants numerically', () => {
    expect(compareInstants('2026-01-01T00:00:00Z', '2026-01-01T00:00:01Z')).toBeLessThan(0)
    expect(compareInstants('2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')).toBe(0)
  })

  it('nowIso returns a UTC ISO string', () => {
    expect(nowIso()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })
})
