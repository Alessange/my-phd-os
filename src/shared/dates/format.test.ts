import { describe, expect, it } from 'vitest'
import type { FormatSettings } from './format'
import {
  formatDate,
  formatDateRange,
  formatDateTime,
  formatDateTimeWithZone,
  formatTime,
  formatWeekday,
  formatZoneLabel,
  orderedWeekdays
} from './format'

const base: FormatSettings = { timezone: 'PT', dateFormat: 'mdy', clock: '24h', weekStartsOn: 1 }
const instant = '2026-09-19T11:59:00.000Z' // Sep 18 23:59 AoE · Sep 19 04:59 PDT

describe('formatDate', () => {
  it('honours the date format setting', () => {
    expect(formatDate(instant, { ...base, dateFormat: 'mdy' })).toBe('Sep 19, 2026')
    expect(formatDate(instant, { ...base, dateFormat: 'dmy' })).toBe('19 Sep 2026')
    expect(formatDate(instant, { ...base, dateFormat: 'iso' })).toBe('2026-09-19')
  })

  it('uses the display zone or an explicit override', () => {
    expect(formatDate(instant, { ...base, timezone: 'AoE', dateFormat: 'iso' })).toBe('2026-09-18')
    expect(formatDate(instant, { ...base, dateFormat: 'iso' }, 'AoE')).toBe('2026-09-18')
  })

  it('never shifts all-day dates through the zone', () => {
    for (const timezone of ['AoE', 'PT', 'Asia/Tokyo', 'UTC+14']) {
      expect(formatDate('2026-09-18', { ...base, timezone, dateFormat: 'iso' })).toBe('2026-09-18')
      expect(formatDate('2026-09-18', { ...base, timezone })).toBe('Sep 18, 2026')
    }
  })

  it('falls back to the locale for system format', () => {
    expect(formatDate(instant, { ...base, dateFormat: 'system' })).toMatch(/2026/)
  })
})

describe('formatTime / formatDateTime', () => {
  it('formats 24h and 12h clocks', () => {
    expect(formatTime(instant, base)).toBe('04:59')
    expect(formatTime(instant, { ...base, clock: '12h' })).toBe('4:59 AM')
    expect(formatTime(instant, base, 'AoE')).toBe('23:59')
  })

  it('joins date and time with a middle dot', () => {
    expect(formatDateTime(instant, base)).toBe('Sep 19, 2026 · 04:59')
    expect(formatDateTime(instant, base, 'AoE')).toBe('Sep 18, 2026 · 23:59')
    expect(formatDateTime('2026-09-18', base)).toBe('Sep 18, 2026')
  })

  it('renders the spec §18 example with source and local zone labels', () => {
    expect(formatDateTimeWithZone(instant, base, 'AoE')).toBe('Sep 18, 2026 · 23:59 AoE')
    expect(formatDateTimeWithZone(instant, base)).toBe('Sep 19, 2026 · 04:59 PDT')
  })
})

describe('formatZoneLabel', () => {
  it('gives abbreviations for IANA zones and labels for fixed zones', () => {
    expect(formatZoneLabel('PT', instant)).toBe('PDT')
    expect(formatZoneLabel('PT', '2026-01-15T12:00:00Z')).toBe('PST')
    expect(formatZoneLabel('America/New_York', instant)).toBe('EDT')
    expect(formatZoneLabel('AoE', instant)).toBe('AoE')
    expect(formatZoneLabel('UTC-12', instant)).toBe('UTC-12:00')
    expect(formatZoneLabel('UTC+5:30', instant)).toBe('UTC+05:30')
    expect(formatZoneLabel('UTC', instant)).toBe('UTC')
  })

  it('uses the settings zone when none is given', () => {
    expect(formatZoneLabel(undefined, instant, { ...base, timezone: 'AoE' })).toBe('AoE')
  })
})

describe('formatDateRange', () => {
  it('collapses same-day ranges', () => {
    expect(formatDateRange('2026-09-19T16:00:00Z', '2026-09-19T17:30:00Z', base)).toBe(
      'Sep 19, 2026 · 09:00–10:30'
    )
  })

  it('spells out multi-day ranges', () => {
    expect(formatDateRange('2026-09-19T06:00:00Z', '2026-09-19T08:00:00Z', base)).toBe(
      'Sep 18, 2026 · 23:00 – Sep 19, 2026 · 01:00'
    )
  })

  it('formats all-day ranges with exclusive ends', () => {
    expect(formatDateRange('2026-09-18', '2026-09-19', base)).toBe('Sep 18, 2026')
    expect(formatDateRange('2026-09-18', '2026-09-21', base)).toBe('Sep 18, 2026 – Sep 20, 2026')
    expect(formatDateRange('2026-09-18', '2026-09-20', base, { endExclusive: false })).toBe(
      'Sep 18, 2026 – Sep 20, 2026'
    )
  })
})

describe('formatWeekday / orderedWeekdays', () => {
  it('formats weekdays in the display zone', () => {
    expect(formatWeekday(instant, base)).toBe('Saturday')
    expect(formatWeekday(instant, { ...base, timezone: 'AoE' })).toBe('Friday')
    expect(formatWeekday('2026-09-18', base, 'short')).toBe('Fri')
  })

  it('orders weekdays from the configured first day', () => {
    expect(orderedWeekdays({ weekStartsOn: 1 })).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(orderedWeekdays({ weekStartsOn: 0 })).toEqual([7, 1, 2, 3, 4, 5, 6])
  })
})
