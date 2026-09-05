import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ConferenceDeadline } from '../types/conference'
import { buildSubscriptionUrl, describeFilters, parseSubscriptionUrl } from './buildSubscriptionUrl'
import { buildConferenceEventInput } from './calendarEvent'
import { compareSnapshots, diffRecord } from './compareSnapshots'
import {
  parseConferenceFeed,
  parseDescription,
  parseSummary,
  statusFor
} from './parseConferenceFeed'
import { stableKeyFor } from './stableKey'

const FIXTURES = join(__dirname, '../../../tests/fixtures/ccf')
const fixture = (name: string): string => readFileSync(join(FIXTURES, name), 'utf8')
const BASE = 'https://ccfddl.com/conference/'

describe('buildSubscriptionUrl (spec §12.1)', () => {
  it('builds the default English and Chinese URLs', () => {
    expect(buildSubscriptionUrl({ language: 'en' })).toBe(`${BASE}deadlines_en.ics`)
    expect(buildSubscriptionUrl({ language: 'zh' })).toBe(`${BASE}deadlines_zh.ics`)
  })

  it('adds one filter or several in the fixed order CCF, CORE, TH-CPL, subject', () => {
    expect(buildSubscriptionUrl({ language: 'en', filters: { ccf: 'A' } })).toBe(
      `${BASE}deadlines_en_ccf_A.ics`
    )
    expect(buildSubscriptionUrl({ language: 'en', filters: { subject: 'AI' } })).toBe(
      `${BASE}deadlines_en_AI.ics`
    )
    expect(
      buildSubscriptionUrl({ language: 'en', filters: { subject: 'SE', thcpl: 'B', core: 'A' } })
    ).toBe(`${BASE}deadlines_en_core_A_thcpl_B_SE.ics`)
    expect(buildSubscriptionUrl({ language: 'zh', filters: { subject: 'DB', ccf: 'B' } })).toBe(
      `${BASE}deadlines_zh_ccf_B_DB.ics`
    )
  })

  it('encodes A* as Astar and decodes it back', () => {
    const url = buildSubscriptionUrl({ language: 'en', filters: { core: 'A*', subject: 'SE' } })
    expect(url).toBe(`${BASE}deadlines_en_core_Astar_SE.ics`)
    expect(parseSubscriptionUrl(url)).toEqual({
      language: 'en',
      filters: { core: 'A*', subject: 'SE' }
    })
  })

  it('recognises official URLs and rejects everything else', () => {
    expect(parseSubscriptionUrl(`${BASE}deadlines_zh.ics`)).toEqual({ language: 'zh', filters: {} })
    expect(parseSubscriptionUrl(`${BASE}deadlines_en_core_A_thcpl_B_SE.ics`)).toEqual({
      language: 'en',
      filters: { core: 'A', thcpl: 'B', subject: 'SE' }
    })
    expect(parseSubscriptionUrl(`${BASE}deadlines_en_XX.ics`)).toBeUndefined()
    expect(parseSubscriptionUrl(`${BASE}deadlines_en_thcpl_B_core_A.ics`)).toBeUndefined() // wrong order
    expect(parseSubscriptionUrl('https://example.org/deadlines_en.ics')).toBeUndefined()
  })

  it('describes filters for labels', () => {
    expect(describeFilters({ core: 'A*', thcpl: 'B', subject: 'SE' })).toBe('CORE A*, TH-CPL B, SE')
    expect(describeFilters(undefined)).toBe('')
  })
})

describe('parseConferenceFeed (docs/upstream-ccf-feed.md)', () => {
  const en = parseConferenceFeed(fixture('deadlines_en_sample.ics'))

  it('reads every VEVENT of the English sample without warnings', () => {
    const vevents = (fixture('deadlines_en_sample.ics').match(/BEGIN:VEVENT/g) ?? []).length
    expect(en.warnings).toEqual([])
    expect(en.deadlines).toHaveLength(vevents)
  })

  it('extracts the AAAI 2026 abstract round exactly as the feed states it', () => {
    const abstract = en.deadlines.find((d) => d.title === 'AAAI 2026 Abstract Deadline')
    expect(abstract).toMatchObject({
      conferenceName: 'AAAI',
      conferenceYear: 2026,
      deadlineKind: 'abstract',
      fullName: 'AAAI Conference on Artificial Intelligence',
      // 23:59:59 at UTC−12 on Jul 25 is 11:59:59Z on Jul 26.
      deadlineAt: '2025-07-26T11:59:59.000Z',
      originalTimezone: 'UTC-12:00',
      originalTimezoneLabel: 'UTC-12',
      category: 'AI',
      ccfRank: 'A',
      coreRank: 'A*',
      thcplRank: 'A',
      conferenceDatesText: 'January 20 - 27, 2026',
      location: 'Singapore EXPO',
      homepageUrl: 'https://aaai.org/conference/aaai/aaai-26/',
      dblpUrl: 'https://dblp.org/db/conf/aaai',
      allDay: false
    })
    expect(abstract?.rawDtStart).toContain('DTSTART;TZID="UTC-12:00":20250725T235959')
    expect(abstract?.upstreamUid).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('derives the same stable key for the same round in English and Chinese feeds, despite different UIDs', () => {
    const zh = parseConferenceFeed(fixture('deadlines_zh_sample.ics'))
    const enAbstract = en.deadlines.find((d) => d.title === 'AAAI 2026 Abstract Deadline')
    const zhAbstract = zh.deadlines.find((d) => d.title === 'AAAI 2026 摘要截稿')
    expect(zhAbstract).toBeDefined()
    expect(zhAbstract?.deadlineKind).toBe('abstract')
    expect(zhAbstract?.stableKey).toBe(enAbstract?.stableKey)
    expect(zhAbstract?.upstreamUid).not.toBe(enAbstract?.upstreamUid)
    expect(zhAbstract).toMatchObject({
      conferenceDatesText: 'January 20 - 27, 2026',
      location: 'Singapore EXPO',
      category: 'AI',
      coreRank: 'A*',
      homepageUrl: 'https://aaai.org/conference/aaai/aaai-26/'
    })
  })

  it('keeps the bracketed round comment and the AoE label from the filtered sample', () => {
    const se = parseConferenceFeed(fixture('deadlines_en_core_Astar_SE_sample.ics'))
    const ase = se.deadlines.find((d) => d.title === 'ASE 2022 Deadline [Abstract Submission]')
    expect(ase).toMatchObject({
      conferenceName: 'ASE',
      conferenceYear: 2022,
      deadlineKind: 'deadline',
      comment: 'Abstract Submission',
      deadlineRound: 'Abstract Submission',
      originalTimezoneLabel: 'AoE',
      originalTimezone: 'UTC-12:00',
      category: 'SE'
    })
    const paper = se.deadlines.find((d) => d.title === 'ASE 2022 Deadline [Paper Submission]')
    expect(paper?.stableKey).not.toBe(ase?.stableKey)
  })

  it('parses summaries and descriptions defensively', () => {
    expect(parseSummary('ICSE 2027 Deadline [Second round 2026]')).toEqual({
      conferenceName: 'ICSE',
      conferenceYear: 2027,
      deadlineKind: 'deadline',
      comment: 'Second round 2026'
    })
    expect(parseSummary('Something unusual')).toMatchObject({
      conferenceName: 'Something unusual',
      deadlineKind: 'deadline'
    })
    const parts = parseDescription(
      'Full Name\n🗓️ Date: TBD\n📍 Location: TBD\n⏰ Original Deadline (AoE): 2026-01-01 23:59:59\nCategory: 软件工程 (SE)\nCCF C\nConference Website: https://x.org\nDBLP Index: https://dblp.org/db/conf/x'
    )
    expect(parts).toEqual({
      fullName: 'Full Name',
      conferenceDatesText: 'TBD',
      location: 'TBD',
      originalTimezoneLabel: 'AoE',
      category: 'SE',
      ccfRank: 'C',
      homepageUrl: 'https://x.org',
      dblpUrl: 'https://dblp.org/db/conf/x'
    })
    expect(parseDescription(undefined)).toEqual({})
  })

  it('reports invalid events as warnings and keeps the rest', () => {
    const broken = fixture('deadlines_zh_sample.ics').replace(
      'DTSTART;TZID="UTC-12:00":20250725T235959',
      'DTSTART;TZID="Mars/Olympus":20250725T235959'
    )
    const parsed = parseConferenceFeed(broken)
    expect(parsed.warnings).toHaveLength(1)
    expect(parsed.warnings[0]).toMatch(/unknown or missing timezone/)
    expect(parsed.deadlines.length).toBeGreaterThan(0)
  })

  it('rejects text that is not a calendar', () => {
    expect(() => parseConferenceFeed('<html>not a feed</html>')).toThrowError(/valid iCalendar/)
  })

  it('derives status from the instant and never from array position', () => {
    expect(statusFor('2025-07-26T11:59:59.000Z', '2026-09-05T00:00:00.000Z')).toBe('passed')
    expect(statusFor('2027-07-26T11:59:59.000Z', '2026-09-05T00:00:00.000Z')).toBe('upcoming')
    expect(
      stableKeyFor({
        conferenceName: ' AAAI ',
        conferenceYear: 2026,
        deadlineKind: 'abstract',
        comment: ' Second  Round '
      })
    ).toBe('aaai|2026|abstract|second round')
  })
})

const record = (
  over: Partial<ConferenceDeadline> & { stableKey: string; title: string }
): ConferenceDeadline => ({
  id: over.stableKey,
  subscriptionId: 's1',
  sourceUrl: `${BASE}deadlines_en.ics`,
  status: 'upcoming',
  upstreamSnapshotHash: 'h0',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deadlineKind: 'deadline',
  firstSeenAt: '2026-01-01T00:00:00.000Z',
  lastSeenAt: '2026-01-01T00:00:00.000Z',
  allDay: false,
  deadlineAt: '2026-07-28T11:59:59.000Z',
  originalTimezone: 'UTC-12:00',
  originalTimezoneLabel: 'AoE',
  homepageUrl: 'https://a.org',
  ...over
})

describe('compareSnapshots (spec §12.8)', () => {
  const en = parseConferenceFeed(fixture('deadlines_en_sample.ics'))
  const incoming = en.deadlines.find((d) => d.title === 'AAAI 2027 Deadline')!

  it('reports deadline, timezone, URL and dates changes with previous and current values', () => {
    const existing = record({
      stableKey: incoming.stableKey,
      title: incoming.title,
      deadlineAt: '2026-07-21T11:59:59.000Z',
      originalTimezoneLabel: 'AoE',
      homepageUrl: 'https://old.example.org',
      conferenceDatesText: 'February 1-2, 2027',
      location: incoming.location
    })
    const changes = diffRecord(existing, incoming)
    expect(changes).toEqual(
      expect.arrayContaining([
        {
          field: 'deadlineAt',
          previousValue: '2026-07-21T11:59:59.000Z',
          currentValue: incoming.deadlineAt
        },
        { field: 'timezone', previousValue: 'AoE', currentValue: 'UTC-12' },
        {
          field: 'homepageUrl',
          previousValue: 'https://old.example.org',
          currentValue: incoming.homepageUrl
        },
        {
          field: 'conferenceDates',
          previousValue: 'February 1-2, 2027',
          currentValue: incoming.conferenceDatesText
        }
      ])
    )
    expect(changes.some((c) => c.field === 'location')).toBe(false)
  })

  it('classifies added, removed, changed and unchanged rounds by stable key', () => {
    const unchanged = record({
      stableKey: incoming.stableKey,
      title: incoming.title,
      deadlineAt: incoming.deadlineAt,
      originalTimezoneLabel: incoming.originalTimezoneLabel,
      homepageUrl: incoming.homepageUrl,
      conferenceDatesText: incoming.conferenceDatesText,
      location: incoming.location
    })
    const vanished = record({ stableKey: 'gone|2027|deadline|', title: 'GONE 2027 Deadline' })
    const alreadyTbd = record({
      stableKey: 'old|2026|deadline|',
      title: 'OLD 2026 Deadline',
      status: 'tbd',
      deadlineAt: undefined
    })
    const comparison = compareSnapshots([unchanged, vanished, alreadyTbd], en.deadlines)
    expect(comparison.unchanged).toBe(1)
    expect(comparison.removed.map((r) => r.title)).toEqual(['GONE 2027 Deadline'])
    expect(comparison.added).toHaveLength(en.deadlines.length - 1)
    expect(comparison.changed).toEqual([])
  })

  it('treats a round that returns after being TBD as a status change', () => {
    const back = record({
      stableKey: incoming.stableKey,
      title: incoming.title,
      status: 'tbd',
      deadlineAt: undefined
    })
    const changes = diffRecord(back, incoming)
    expect(changes).toEqual(
      expect.arrayContaining([{ field: 'status', previousValue: 'tbd', currentValue: 'upcoming' }])
    )
  })
})

describe('buildConferenceEventInput (spec §12.7)', () => {
  it('builds a source-managed deadline event at the exact instant in the original zone', () => {
    const deadline = record({
      stableKey: 'k',
      title: 'AAAI 2027 Deadline',
      fullName: 'AAAI Conference on Artificial Intelligence',
      conferenceDatesText: 'February 16-23, 2027',
      location: 'Montréal'
    })
    expect(buildConferenceEventInput(deadline, 'src')).toMatchObject({
      title: 'AAAI 2027 Deadline',
      startAt: '2026-07-28T11:59:59.000Z',
      endAt: '2026-07-28T11:59:59.000Z',
      timezone: 'UTC-12:00',
      allDay: false,
      category: 'deadline',
      sourceCalendarId: 'src',
      linkedConferenceDeadlineId: 'k',
      sourceManaged: true,
      sourceLabel: 'CCF Deadlines',
      url: 'https://a.org',
      location: 'Montréal'
    })
    expect(buildConferenceEventInput(deadline, 'src')?.description).toContain(
      'Original deadline timezone: AoE'
    )
  })

  it('refuses TBD deadlines and writes all-day deadlines as dates', () => {
    expect(
      buildConferenceEventInput(
        record({ stableKey: 't', title: 'T', status: 'tbd', deadlineAt: undefined }),
        'src'
      )
    ).toBeUndefined()
    expect(
      buildConferenceEventInput(
        record({
          stableKey: 'a',
          title: 'A',
          allDay: true,
          deadlineAt: '2026-10-01T23:59:59.000Z',
          originalTimezone: undefined
        }),
        'src'
      )
    ).toMatchObject({ allDay: true, startAt: '2026-10-01', endAt: '2026-10-02', timezone: 'UTC' })
  })
})
