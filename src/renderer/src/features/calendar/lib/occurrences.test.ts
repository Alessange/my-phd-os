import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '@shared/types/calendar'
import { expandOccurrences, occurrenceEndInstant, occurrenceStartInstant } from './occurrences'

const event = (
  over: Partial<CalendarEvent> & { id: string; title: string; startAt: string; endAt: string }
): CalendarEvent => ({
  timezone: 'America/Los_Angeles',
  allDay: false,
  category: 'course',
  sourceManaged: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over
})

const ZONE = 'America/Vancouver'

describe('expandOccurrences', () => {
  const seminar = event({
    id: 'sem',
    title: 'Seminar',
    // Tuesdays 10:00–11:30 Los Angeles, from Sep 8 2026, until Dec 15 2026 (UTC UNTIL as Google writes it).
    startAt: '2026-09-08T17:00:00.000Z',
    endAt: '2026-09-08T18:30:00.000Z',
    recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU;UNTIL=20261215T075959Z',
    exdates: ['2026-11-24T18:00:00.000Z']
  })

  it('keeps the wall-clock time across the DST change and honours EXDATE and UNTIL', () => {
    const range = { start: '2026-10-25T00:00:00.000Z', end: '2026-12-31T00:00:00.000Z' }
    const starts = expandOccurrences([seminar], range, ZONE).map((o) => o.startAt)
    // Oct 27 is PDT (17:00Z); DST ends Nov 1 2026, so Nov 3 onwards is PST (18:00Z); Nov 24 is
    // excluded by EXDATE and Dec 15 by UNTIL.
    expect(starts).toEqual([
      '2026-10-27T17:00:00.000Z',
      '2026-11-03T18:00:00.000Z',
      '2026-11-10T18:00:00.000Z',
      '2026-11-17T18:00:00.000Z',
      '2026-12-01T18:00:00.000Z',
      '2026-12-08T18:00:00.000Z'
    ])
    const first = expandOccurrences([seminar], range, ZONE)[0]
    expect(first).toMatchObject({
      key: 'sem@2026-10-27T17:00:00.000Z',
      recurring: true,
      endAt: '2026-10-27T18:30:00.000Z'
    })
  })

  it('replaces an overridden occurrence with its modified instance', () => {
    const moved = event({
      id: 'moved',
      title: 'Seminar (moved)',
      startAt: '2026-10-13T21:00:00.000Z',
      endAt: '2026-10-13T22:30:00.000Z',
      recurrenceId: '2026-10-13T17:00:00.000Z',
      recurrenceMasterId: 'sem'
    })
    const range = { start: '2026-10-05T00:00:00.000Z', end: '2026-10-19T00:00:00.000Z' }
    const occurrences = expandOccurrences([seminar, moved], range, ZONE)
    expect(occurrences.map((o) => `${o.event.id}:${o.startAt}`)).toEqual([
      'sem:2026-10-06T17:00:00.000Z',
      'moved:2026-10-13T21:00:00.000Z'
    ])
    expect(occurrences[1].recurring).toBe(false)
  })

  it('expands RDATE-only series, monthly last-day rules and all-day series', () => {
    const office = event({
      id: 'office',
      title: 'Office hours',
      startAt: '2026-09-16T13:00:00.000Z',
      endAt: '2026-09-16T14:00:00.000Z',
      timezone: 'Europe/Berlin',
      rdates: ['2026-09-23T13:00:00.000Z', '2026-10-07T13:00:00.000Z']
    })
    const report = event({
      id: 'report',
      title: 'Monthly report',
      startAt: '2026-09-30T10:00:00.000Z',
      endAt: '2026-09-30T10:30:00.000Z',
      timezone: 'Asia/Shanghai',
      recurrenceRule: 'FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=4'
    })
    const standup = event({
      id: 'standup',
      title: 'Lab day',
      startAt: '2026-09-07',
      endAt: '2026-09-08',
      allDay: true,
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO;COUNT=3'
    })
    const range = { start: '2026-09-01T00:00:00.000Z', end: '2026-11-01T00:00:00.000Z' }
    const occurrences = expandOccurrences([office, report, standup], range, ZONE)
    expect(occurrences.filter((o) => o.event.id === 'office').map((o) => o.startAt)).toEqual([
      '2026-09-16T13:00:00.000Z',
      '2026-09-23T13:00:00.000Z',
      '2026-10-07T13:00:00.000Z'
    ])
    expect(occurrences.filter((o) => o.event.id === 'report').map((o) => o.startAt)).toEqual([
      '2026-09-30T10:00:00.000Z',
      '2026-10-31T10:00:00.000Z'
    ])
    expect(occurrences.filter((o) => o.event.id === 'standup')).toEqual([
      expect.objectContaining({
        startAt: '2026-09-07',
        endAt: '2026-09-08',
        allDay: true,
        recurring: true
      }),
      expect.objectContaining({ startAt: '2026-09-14', endAt: '2026-09-15' }),
      expect.objectContaining({ startAt: '2026-09-21', endAt: '2026-09-22' })
    ])
  })

  it('keeps single events that overlap the range and drops the rest', () => {
    const inside = event({
      id: 'a',
      title: 'A',
      startAt: '2026-09-10T10:00:00.000Z',
      endAt: '2026-09-10T11:00:00.000Z'
    })
    const straddling = event({
      id: 'b',
      title: 'B',
      startAt: '2026-08-31T23:00:00.000Z',
      endAt: '2026-09-01T01:00:00.000Z'
    })
    const outside = event({
      id: 'c',
      title: 'C',
      startAt: '2026-12-10T10:00:00.000Z',
      endAt: '2026-12-10T11:00:00.000Z'
    })
    const allDay = event({
      id: 'd',
      title: 'D',
      startAt: '2026-09-01',
      endAt: '2026-09-02',
      allDay: true
    })
    const range = { start: '2026-09-01T00:00:00.000Z', end: '2026-10-01T00:00:00.000Z' }
    expect(
      expandOccurrences([inside, straddling, outside, allDay], range, ZONE).map((o) => o.key)
    ).toEqual(['b', 'd', 'a'])
  })

  it('converts all-day boundaries to instants in the display zone', () => {
    const occurrence = { startAt: '2026-09-07', endAt: '2026-09-08', allDay: true }
    // Midnight in Vancouver (PDT) is 07:00Z.
    expect(occurrenceStartInstant(occurrence, ZONE)).toBe('2026-09-07T07:00:00.000Z')
    expect(occurrenceEndInstant(occurrence, ZONE)).toBe('2026-09-08T07:00:00.000Z')
    expect(
      occurrenceStartInstant({ startAt: '2026-09-07T10:00:00.000Z', allDay: false }, ZONE)
    ).toBe('2026-09-07T10:00:00.000Z')
  })
})
