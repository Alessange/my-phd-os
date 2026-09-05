import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../types/calendar'
import { detectDuplicates } from './duplicates'
import { parseIcsFiles, parsedDateRange, type ParsedIcsEvent } from './parse'
import { foldLine, serializeIcs } from './serialize'

const FIXTURES = join(__dirname, '../../../tests/fixtures/ics')
const fixture = (name: string): { name: string; text: string } => ({
  name,
  text: readFileSync(join(FIXTURES, name), 'utf8')
})

const APP_ZONE = 'America/Vancouver'
const parseOne = (name: string): ReturnType<typeof parseIcsFiles>['files'][number] => {
  const result = parseIcsFiles([fixture(name)], { appZone: APP_ZONE })
  expect(result.invalidFiles).toEqual([])
  return result.files[0]
}
const byUid = (events: ParsedIcsEvent[], uid: string, recurrenceId?: string): ParsedIcsEvent => {
  const found = events.find((e) => e.uid === uid && e.recurrenceId === recurrenceId)
  if (!found) throw new Error(`no event ${uid} ${recurrenceId ?? ''}`)
  return found
}

describe('parseIcsFiles: Google export', () => {
  const file = parseOne('google-export-sample.ics')

  it('reads a TZID recurring event with RRULE and EXDATE as instants in that zone', () => {
    const seminar = byUid(file.events, 'fixture-weekly-seminar@example.test')
    // 10:00 PDT on Sep 8 2026 = 17:00Z.
    expect(seminar).toMatchObject({
      title: 'Fixture Group Seminar',
      startAt: '2026-09-08T17:00:00.000Z',
      endAt: '2026-09-08T18:30:00.000Z',
      allDay: false,
      timezone: 'America/Los_Angeles',
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU;UNTIL=20261215T075959Z',
      location: 'ICICS 238',
      cancelled: false
    })
    // Nov 24 is after the DST switch: 10:00 PST = 18:00Z.
    expect(seminar.exdates).toEqual(['2026-11-24T18:00:00.000Z'])
    expect(seminar.description).toContain('Bring one slide')
  })

  it('keeps a modified recurrence instance separate, keyed by UID + RECURRENCE-ID', () => {
    const moved = byUid(
      file.events,
      'fixture-weekly-seminar@example.test',
      '2026-10-13T17:00:00.000Z'
    )
    expect(moved).toMatchObject({
      title: 'Fixture Group Seminar (moved)',
      startAt: '2026-10-13T21:00:00.000Z',
      recurrenceId: '2026-10-13T17:00:00.000Z',
      key: 'fixture-weekly-seminar@example.test@2026-10-13T17:00:00.000Z'
    })
  })

  it('keeps all-day events as dates with an exclusive end, without zone shifting', () => {
    expect(byUid(file.events, 'fixture-allday-retreat@example.test')).toMatchObject({
      allDay: true,
      startAt: '2026-10-12',
      endAt: '2026-10-14'
    })
  })

  it('reads UTC events as UTC', () => {
    expect(byUid(file.events, 'fixture-utc-call@example.test')).toMatchObject({
      startAt: '2026-09-20T16:00:00.000Z',
      endAt: '2026-09-20T17:00:00.000Z',
      timezone: 'UTC'
    })
  })

  it('flags cancelled events', () => {
    const cancelled = file.events.filter((e) => e.cancelled)
    expect(cancelled.length).toBeGreaterThan(0)
  })
})

describe('parseIcsFiles: floating times, RDATE, unusual zones', () => {
  const file = parseOne('floating-and-rdate-sample.ics')

  it('interprets floating times in the application timezone', () => {
    // 09:00 floating on Sep 15 → Vancouver (PDT, UTC−7) → 16:00Z.
    expect(byUid(file.events, 'fixture-floating-writing@example.test')).toMatchObject({
      startAt: '2026-09-15T16:00:00.000Z',
      endAt: '2026-09-15T18:00:00.000Z',
      timezone: APP_ZONE
    })
  })

  it('reads RDATE lists', () => {
    expect(byUid(file.events, 'fixture-rdate-office-hours@example.test').rdates).toEqual([
      '2026-09-23T13:00:00.000Z',
      '2026-10-07T13:00:00.000Z'
    ])
  })

  it('reads monthly rules and Etc/GMT+12 (AoE-style) zones', () => {
    expect(byUid(file.events, 'fixture-monthly-report@example.test').recurrenceRule).toBe(
      'FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=4'
    )
    // 23:59 at UTC−12 on Oct 1 = 11:59Z on Oct 2.
    expect(byUid(file.events, 'fixture-aoe-style-utc-minus-12@example.test')).toMatchObject({
      startAt: '2026-10-02T11:59:00.000Z',
      timezone: 'Etc/GMT+12'
    })
  })
})

describe('parseIcsFiles: partially valid file', () => {
  it('imports the valid events and reports the broken ones by reason', () => {
    const file = parseOne('partially-invalid.ics')
    expect(file.events.map((e) => e.uid)).toEqual([
      'fixture-valid-one@example.test',
      'fixture-valid-two@example.test'
    ])
    expect(file.invalidEvents).toHaveLength(2)
    expect(file.invalidEvents[0]).toMatchObject({
      summary: 'Fixture Event Missing DTSTART (should be reported, not imported)',
      reason: expect.stringContaining('no DTSTART')
    })
    expect(file.invalidEvents[1].reason).toMatch(/not a valid date|invalid date-time/)
    // All-day without DTEND spans one day.
    expect(byUid(file.events, 'fixture-valid-two@example.test')).toMatchObject({
      allDay: true,
      startAt: '2026-09-21',
      endAt: '2026-09-22'
    })
  })

  it('rejects files that are not iCalendar and keeps parsing the others', () => {
    const result = parseIcsFiles(
      [{ name: 'junk.ics', text: 'hello world' }, fixture('partially-invalid.ics')],
      { appZone: APP_ZONE }
    )
    expect(result.invalidFiles).toEqual([
      { name: 'junk.ics', reason: expect.stringContaining('Not a valid iCalendar file') }
    ])
    expect(result.files).toHaveLength(1)
  })

  it('computes the date range across mixed all-day and timed events', () => {
    const file = parseOne('partially-invalid.ics')
    expect(parsedDateRange(file.events)).toEqual({
      start: '2026-09-18T12:00:00.000Z',
      end: '2026-09-22'
    })
    expect(parsedDateRange([])).toBeUndefined()
  })
})

const existing = (
  over: Partial<CalendarEvent> & { id: string; title: string; startAt: string }
): CalendarEvent => ({
  endAt: over.startAt,
  timezone: 'UTC',
  allDay: false,
  category: 'meeting',
  sourceManaged: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over
})

describe('detectDuplicates', () => {
  const file = parseOne('google-export-sample.ics')

  it('matches by UID first, then recurrence id, then start instant + title, then source + start', () => {
    const master = byUid(file.events, 'fixture-weekly-seminar@example.test')
    const moved = byUid(
      file.events,
      'fixture-weekly-seminar@example.test',
      '2026-10-13T17:00:00.000Z'
    )
    const retreat = byUid(file.events, 'fixture-allday-retreat@example.test')
    const call = byUid(file.events, 'fixture-utc-call@example.test')
    const matches = detectDuplicates(
      file.events,
      [
        existing({
          id: 'e-master',
          title: 'Old title',
          startAt: master.startAt,
          importedUid: master.uid
        }),
        existing({
          id: 'e-moved',
          title: 'Old moved',
          startAt: moved.startAt,
          importedUid: moved.uid,
          recurrenceId: moved.recurrenceId
        }),
        existing({
          id: 'e-retreat',
          title: 'fixture lab retreat',
          startAt: retreat.startAt,
          allDay: true
        }),
        existing({
          id: 'e-call',
          title: 'Something else',
          startAt: call.startAt,
          sourceCalendarId: 'src1'
        })
      ],
      'src1'
    )
    const byKey = Object.fromEntries(matches.map((m) => [m.key, m]))
    expect(byKey[master.key]).toMatchObject({ existingEventId: 'e-master', reason: 'uid' })
    expect(byKey[moved.key]).toMatchObject({ existingEventId: 'e-moved', reason: 'recurrenceId' })
    expect(byKey[retreat.key]).toMatchObject({
      existingEventId: 'e-retreat',
      reason: 'startInstant'
    })
    expect(byKey[call.key]).toMatchObject({ existingEventId: 'e-call', reason: 'source' })
  })

  it('does not treat a different occurrence of the same UID as a duplicate of the master', () => {
    const master = byUid(file.events, 'fixture-weekly-seminar@example.test')
    const matches = detectDuplicates(
      [master],
      [
        existing({
          id: 'e-instance',
          title: 'Instance',
          startAt: '2026-10-13T21:00:00.000Z',
          importedUid: master.uid,
          recurrenceId: '2026-10-13T17:00:00.000Z'
        })
      ]
    )
    expect(matches).toEqual([])
  })
})

describe('serializeIcs', () => {
  const events: CalendarEvent[] = [
    existing({
      id: 'e1',
      title: 'Seminar; with, punctuation\nand a second line',
      description: 'Bring one slide',
      location: 'ICICS 238',
      startAt: '2026-09-08T17:00:00.000Z',
      endAt: '2026-09-08T18:30:00.000Z',
      timezone: 'America/Los_Angeles',
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU;UNTIL=20261215T075959Z',
      exdates: ['2026-11-24T18:00:00.000Z'],
      importedUid: 'seminar@example.test',
      category: 'course',
      url: 'https://example.org/seminar'
    }),
    existing({
      id: 'e2',
      title: 'Retreat',
      startAt: '2026-10-12',
      endAt: '2026-10-14',
      allDay: true,
      timezone: 'America/Vancouver'
    }),
    existing({
      id: 'e3',
      title: 'AoE deadline',
      startAt: '2026-10-02T11:59:00.000Z',
      endAt: '2026-10-02T11:59:00.000Z',
      timezone: 'AoE',
      category: 'deadline',
      sourceManaged: true,
      sourceLabel: 'CCF Deadlines'
    })
  ]

  it('writes IANA zones as local wall time with TZID, all-day as dates, fixed offsets as UTC', () => {
    const text = serializeIcs(events, { nowIso: '2026-09-05T10:00:00.000Z', calendarName: 'Test' })
    expect(text).toContain('DTSTART;TZID=America/Los_Angeles:20260908T100000')
    expect(text).toContain('DTEND;TZID=America/Los_Angeles:20260908T113000')
    expect(text).toContain('EXDATE;TZID=America/Los_Angeles:20261124T100000')
    expect(text).toContain('RRULE:FREQ=WEEKLY;BYDAY=TU;UNTIL=20261215T075959Z')
    expect(text).toContain('DTSTART;VALUE=DATE:20261012')
    expect(text).toContain('DTEND;VALUE=DATE:20261014')
    expect(text).toContain('DTSTART:20261002T115900Z')
    expect(text).toContain('UID:seminar@example.test')
    expect(text).toContain('UID:e2@my-phd-os')
    expect(text).toContain('X-MYPHDOS-SOURCE-MANAGED:TRUE')
    expect(text).toContain('X-WR-CALNAME:Test')
    expect(text).toContain('SUMMARY:Seminar\\; with\\, punctuation\\nand a second line')
    expect(text.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true)
  })

  it('round-trips through the parser with identical instants, zones, recurrence and all-day state', () => {
    const text = serializeIcs(events, { nowIso: '2026-09-05T10:00:00.000Z' })
    const parsed = parseIcsFiles([{ name: 'export.ics', text }], { appZone: APP_ZONE })
    expect(parsed.invalidFiles).toEqual([])
    const back = parsed.files[0].events
    expect(back).toHaveLength(3)
    expect(back[0]).toMatchObject({
      uid: 'seminar@example.test',
      title: 'Seminar; with, punctuation\nand a second line',
      startAt: '2026-09-08T17:00:00.000Z',
      endAt: '2026-09-08T18:30:00.000Z',
      timezone: 'America/Los_Angeles',
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU;UNTIL=20261215T075959Z',
      exdates: ['2026-11-24T18:00:00.000Z'],
      url: 'https://example.org/seminar'
    })
    expect(back[1]).toMatchObject({ allDay: true, startAt: '2026-10-12', endAt: '2026-10-14' })
    expect(back[2]).toMatchObject({ startAt: '2026-10-02T11:59:00.000Z', timezone: 'UTC' })
  })

  it('folds long lines at 75 octets and keeps multibyte characters intact', () => {
    const folded = foldLine(`DESCRIPTION:${'会'.repeat(60)}`)
    const lines = folded.split('\r\n')
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true)
    expect(lines.slice(1).every((l) => l.startsWith(' '))).toBe(true)
    expect(folded.replace(/\r\n /g, '')).toBe(`DESCRIPTION:${'会'.repeat(60)}`)
  })
})
