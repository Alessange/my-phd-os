import { describe, expect, it } from 'vitest'
import type { ConferenceDeadlineChangeView, ConferenceDeadlineView } from '../types/conference'
import {
  DEFAULT_CONFERENCE_FILTERS,
  changeHeadline,
  changeValueText,
  collectFacets,
  countActiveFilters,
  filterConferenceDeadlines,
  followedTimeProgress,
  groupConferenceRounds,
  nearestFollowedDeadline,
  sortChanges,
  sortConferenceDeadlines,
  updatedDeadlineIds,
  urgencyLevel,
  conferenceSubline,
  CONFERENCE_COLOR_COUNT,
  assignConferenceColors,
  deadlineProgress
} from './views'

const NOW = '2026-09-05T12:00:00.000Z'

const view = (
  over: Partial<ConferenceDeadlineView> & { id: string; title: string }
): ConferenceDeadlineView => ({
  subscriptionId: 's1',
  subscriptionLabel: 'deadlines_en',
  sourceUrl: 'https://ccfddl.com/conference/deadlines_en.ics',
  status: 'upcoming',
  upstreamSnapshotHash: 'h1',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  stableKey: over.id,
  deadlineKind: 'deadline',
  firstSeenAt: '2026-08-01T00:00:00.000Z',
  lastSeenAt: '2026-09-05T00:00:00.000Z',
  allDay: false,
  ...over
})

const ITEMS: ConferenceDeadlineView[] = [
  view({
    id: 'neurips',
    title: 'NeurIPS 2026',
    conferenceName: 'NeurIPS',
    conferenceYear: 2026,
    category: 'AI',
    ccfRank: 'A',
    coreRank: 'A*',
    deadlineAt: '2026-10-01T11:59:00.000Z',
    followed: { conferenceDeadlineId: 'neurips', followedAt: '2026-09-01T12:00:00.000Z' }
  }),
  view({
    id: 'icml-abs',
    title: 'ICML 2027 (Abstract)',
    conferenceName: 'ICML',
    conferenceYear: 2027,
    category: 'AI',
    ccfRank: 'A',
    deadlineKind: 'abstract',
    deadlineAt: '2027-01-20T11:59:00.000Z'
  }),
  view({
    id: 'icml',
    title: 'ICML 2027',
    conferenceName: 'ICML',
    conferenceYear: 2027,
    category: 'AI',
    ccfRank: 'A',
    deadlineAt: '2027-01-27T11:59:00.000Z'
  }),
  view({
    id: 'icse',
    title: 'ICSE 2027',
    conferenceName: 'ICSE',
    conferenceYear: 2027,
    category: 'SE',
    ccfRank: 'A',
    coreRank: 'A*',
    thcplRank: 'A',
    status: 'passed',
    deadlineAt: '2026-08-20T11:59:00.000Z'
  }),
  view({
    id: 'sosp',
    title: 'SOSP 2027',
    conferenceName: 'SOSP',
    conferenceYear: 2027,
    category: 'DS',
    ccfRank: 'A',
    status: 'tbd',
    location: 'Seoul, Korea'
  })
]

describe('conference views', () => {
  it('hides passed rounds by default and counts the active filters', () => {
    const visible = filterConferenceDeadlines(ITEMS, DEFAULT_CONFERENCE_FILTERS)
    expect(visible.map((i) => i.id)).toEqual(['neurips', 'icml-abs', 'icml', 'sosp'])
    expect(countActiveFilters(DEFAULT_CONFERENCE_FILTERS)).toBe(0)
    expect(
      countActiveFilters({ ...DEFAULT_CONFERENCE_FILTERS, search: 'icml', hidePassed: false })
    ).toBe(2)
  })

  it('shows passed rounds when the status filter asks for them explicitly', () => {
    const visible = filterConferenceDeadlines(ITEMS, {
      ...DEFAULT_CONFERENCE_FILTERS,
      status: 'passed'
    })
    expect(visible.map((i) => i.id)).toEqual(['icse'])
  })

  it('filters by search, facets and followed-only', () => {
    expect(
      filterConferenceDeadlines(ITEMS, { ...DEFAULT_CONFERENCE_FILTERS, search: 'seoul' }).map(
        (i) => i.id
      )
    ).toEqual(['sosp'])
    expect(
      filterConferenceDeadlines(ITEMS, { ...DEFAULT_CONFERENCE_FILTERS, coreRank: 'A*' }).map(
        (i) => i.id
      )
    ).toEqual(['neurips'])
    expect(
      filterConferenceDeadlines(ITEMS, {
        ...DEFAULT_CONFERENCE_FILTERS,
        hidePassed: false,
        thcplRank: 'A'
      }).map((i) => i.id)
    ).toEqual(['icse'])
    expect(
      filterConferenceDeadlines(ITEMS, { ...DEFAULT_CONFERENCE_FILTERS, year: 2026 }).map(
        (i) => i.id
      )
    ).toEqual(['neurips'])
    expect(
      filterConferenceDeadlines(ITEMS, { ...DEFAULT_CONFERENCE_FILTERS, followedOnly: true }).map(
        (i) => i.id
      )
    ).toEqual(['neurips'])
  })

  it('collects facets from the records with ranks in canonical order and years newest first', () => {
    const facets = collectFacets(ITEMS)
    expect(facets.categories).toEqual(['AI', 'DS', 'SE'])
    expect(facets.ccfRanks).toEqual(['A'])
    expect(facets.coreRanks).toEqual(['A*'])
    expect(facets.thcplRanks).toEqual(['A'])
    expect(facets.years).toEqual([2027, 2026])
  })

  it('sorts nearest-first with TBD after upcoming and passed rounds last', () => {
    expect(sortConferenceDeadlines(ITEMS, 'nearest').map((i) => i.id)).toEqual([
      'neurips',
      'icml-abs',
      'icml',
      'sosp',
      'icse'
    ])
    expect(sortConferenceDeadlines(ITEMS, 'farthest').map((i) => i.id)).toEqual([
      'icml',
      'icml-abs',
      'neurips',
      'sosp',
      'icse'
    ])
    expect(sortConferenceDeadlines(ITEMS, 'name').map((i) => i.id)).toEqual([
      'icml-abs',
      'icml',
      'icse',
      'neurips',
      'sosp'
    ])
    expect(sortConferenceDeadlines(ITEMS, 'year').map((i) => i.id)[4]).toBe('neurips')
  })

  it('groups rounds of the same conference and year, preserving order', () => {
    const groups = groupConferenceRounds(sortConferenceDeadlines(ITEMS, 'nearest'))
    expect(groups.map((g) => [g.name, g.year, g.items.length])).toEqual([
      ['NeurIPS', 2026, 1],
      ['ICML', 2027, 2],
      ['SOSP', 2027, 1],
      ['ICSE', 2027, 1]
    ])
  })

  it('finds the nearest followed upcoming deadline only', () => {
    expect(nearestFollowedDeadline(ITEMS, NOW)?.id).toBe('neurips')
    expect(nearestFollowedDeadline(ITEMS, '2026-10-02T00:00:00.000Z')).toBeUndefined()
    const unfollowed = ITEMS.map((i) => ({ ...i, followed: undefined }))
    expect(nearestFollowedDeadline(unfollowed, NOW)).toBeUndefined()
  })

  it('measures time elapsed since following, never for TBD or unfollowed rounds', () => {
    // Followed Sep 1 12:00, deadline Oct 1 11:59 → 4 days of ~30 into the window.
    const progress = followedTimeProgress(ITEMS[0], NOW)
    expect(progress?.fraction).toBeCloseTo(4 / 29.999, 2)
    expect(followedTimeProgress(ITEMS[1], NOW)).toBeUndefined()
    expect(
      followedTimeProgress(
        { ...ITEMS[4], followed: { conferenceDeadlineId: 'sosp', followedAt: NOW } },
        NOW
      )
    ).toBeUndefined()
    // A deadline earlier than followedAt is fully elapsed.
    expect(
      followedTimeProgress(
        {
          ...ITEMS[0],
          followed: { conferenceDeadlineId: 'neurips', followedAt: '2026-10-05T00:00:00.000Z' }
        },
        '2026-10-06T00:00:00.000Z'
      )?.fraction
    ).toBe(1)
  })

  it('describes upstream changes with followed conferences first', () => {
    const changes: ConferenceDeadlineChangeView[] = [
      {
        id: 'c1',
        conferenceDeadlineId: 'icml',
        conferenceTitle: 'ICML 2027',
        followed: false,
        field: 'deadlineAt',
        previousValue: '2027-01-27T11:59:00.000Z',
        currentValue: '2027-02-03T11:59:00.000Z',
        detectedAt: '2026-09-05T10:00:00.000Z',
        upstreamSnapshotHash: 'h2',
        acknowledged: false
      },
      {
        id: 'c2',
        conferenceDeadlineId: 'neurips',
        conferenceTitle: 'NeurIPS 2026',
        followed: true,
        field: 'status',
        previousValue: 'upcoming',
        currentValue: 'tbd',
        detectedAt: '2026-09-05T09:00:00.000Z',
        upstreamSnapshotHash: 'h2',
        acknowledged: false
      },
      {
        id: 'c3',
        conferenceDeadlineId: 'sosp',
        conferenceTitle: 'SOSP 2027',
        followed: false,
        field: 'round',
        previousValue: undefined,
        currentValue: 'Round 2',
        detectedAt: '2026-09-05T11:00:00.000Z',
        upstreamSnapshotHash: 'h2',
        acknowledged: true
      }
    ]
    expect(sortChanges(changes).map((c) => c.id)).toEqual(['c2', 'c3', 'c1'])
    expect(changeHeadline(changes[1])).toBe('NeurIPS 2026 was updated by CCF Deadlines.')
    const fmt = (iso: string): string => `@${iso.slice(0, 10)}`
    expect(changeValueText('deadlineAt', changes[0].previousValue, fmt)).toBe('@2027-01-27')
    expect(changeValueText('status', 'tbd', fmt)).toBe('TBD')
    expect(changeValueText('round', undefined, fmt)).toBe('—')
    expect(changeValueText('round', 'Round 2', fmt)).toBe('Round 2')
    expect([...updatedDeadlineIds(changes)].sort()).toEqual(['icml', 'neurips'])
  })
})

describe('urgencyLevel / conferenceSubline', () => {
  const now = '2026-09-05T12:00:00.000Z'
  it('classifies by remaining time and status', () => {
    expect(urgencyLevel({ status: 'tbd' }, now)).toBe('tbd')
    expect(urgencyLevel({ status: 'passed', deadlineAt: '2026-09-01T00:00:00.000Z' }, now)).toBe(
      'passed'
    )
    expect(urgencyLevel({ status: 'upcoming', deadlineAt: '2026-09-04T00:00:00.000Z' }, now)).toBe(
      'passed'
    )
    expect(urgencyLevel({ status: 'upcoming', deadlineAt: '2026-09-05T20:00:00.000Z' }, now)).toBe(
      'urgent'
    )
    expect(urgencyLevel({ status: 'upcoming', deadlineAt: '2026-09-09T12:00:00.000Z' }, now)).toBe(
      'soon'
    )
    expect(urgencyLevel({ status: 'upcoming', deadlineAt: '2026-09-25T12:00:00.000Z' }, now)).toBe(
      'near'
    )
    expect(urgencyLevel({ status: 'upcoming', deadlineAt: '2026-12-01T12:00:00.000Z' }, now)).toBe(
      'far'
    )
  })

  it('builds the one-line summary from the fields the feed provided', () => {
    expect(
      conferenceSubline({
        ccfRank: 'A',
        coreRank: 'A*',
        deadlineKind: 'abstract',
        comment: 'Round 2'
      })
    ).toBe('CCF A · CORE A* · Abstract · Round 2')
    expect(conferenceSubline({ deadlineKind: 'deadline' })).toBe('')
  })
})

describe('conference row colours', () => {
  const item = (id: string, stableKey: string): { id: string; stableKey: string } => ({
    id,
    stableKey
  })

  it('gives every conference on screen its own palette slot', () => {
    const items = Array.from({ length: CONFERENCE_COLOR_COUNT }, (_, i) =>
      item(`id${i}`, `conf-${i}|2027|deadline|`)
    )
    const colors = assignConferenceColors(items)
    expect(colors.size).toBe(CONFERENCE_COLOR_COUNT)
    expect(new Set(colors.values()).size).toBe(CONFERENCE_COLOR_COUNT)
    for (const token of colors.values()) expect(token).toMatch(/^conference-([1-9]|10)$/)
  })

  it('keeps a conference on the same colour when the list is reordered or shrinks', () => {
    const all = [
      item('a', 'neurips|2027|deadline|'),
      item('b', 'icml|2027|deadline|'),
      item('c', 'icse|2027|deadline|')
    ]
    const first = assignConferenceColors(all)
    const reversed = assignConferenceColors([...all].reverse())
    expect([...reversed.entries()].sort()).toEqual([...first.entries()].sort())
    // Dropping one leaves the others where they were.
    const fewer = assignConferenceColors([all[0], all[2]])
    expect(fewer.get('a')).toBe(first.get('a'))
    expect(fewer.get('c')).toBe(first.get('c'))
  })

  it('repeats the palette beyond ten conferences rather than failing', () => {
    const items = Array.from({ length: 14 }, (_, i) => item(`id${i}`, `c-${i}|2027|deadline|`))
    const colors = assignConferenceColors(items)
    expect(colors.size).toBe(14)
    expect(new Set(colors.values()).size).toBe(CONFERENCE_COLOR_COUNT)
  })
})

describe('deadlineProgress', () => {
  const followedOn = (followedAt: string, deadlineAt: string): ConferenceDeadlineView =>
    view({
      id: 'x',
      title: 'x',
      deadlineAt,
      firstSeenAt: followedAt,
      followed: { conferenceDeadlineId: 'x', followedAt }
    })
  const span = followedOn('2026-09-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')

  it('runs from empty on the day it was added to full at the deadline', () => {
    expect(deadlineProgress(span, '2026-09-01T00:00:00.000Z')).toBe(0)
    expect(deadlineProgress(span, '2026-09-16T00:00:00.000Z')).toBeCloseTo(0.5, 5)
    expect(deadlineProgress(span, '2026-10-01T00:00:00.000Z')).toBe(1)
  })

  it('moves every single day, which the old shared scale did not', () => {
    // The furthest conference used to define the scale and so sat pinned at 100% for ever.
    const daily = Array.from({ length: 8 }, (_, d) =>
      deadlineProgress(
        span,
        new Date(Date.parse('2026-09-01T00:00:00.000Z') + d * 86_400_000).toISOString()
      )
    ) as number[]
    for (let i = 1; i < daily.length; i += 1) {
      expect(daily[i]).toBeGreaterThan(daily[i - 1])
      expect(daily[i] - daily[i - 1]).toBeCloseTo(1 / 30, 3)
    }
  })

  it('measures each conference against its own window, so none is pinned', () => {
    const near = followedOn('2026-09-01T00:00:00.000Z', '2026-09-11T00:00:00.000Z')
    const far = followedOn('2026-09-01T00:00:00.000Z', '2027-09-01T00:00:00.000Z')
    const now = '2026-09-06T00:00:00.000Z'
    expect(deadlineProgress(near, now)).toBeCloseTo(0.5, 5)
    expect(deadlineProgress(far, now)).toBeLessThan(0.05)
    // The far one still advances rather than standing still.
    expect(deadlineProgress(far, '2026-12-01T00:00:00.000Z') as number).toBeGreaterThan(
      deadlineProgress(far, now) as number
    )
  })

  it('is full for a passed deadline and undefined for TBD', () => {
    expect(deadlineProgress({ ...span, status: 'passed' }, '2026-09-05T00:00:00.000Z')).toBe(1)
    expect(deadlineProgress(span, '2027-01-01T00:00:00.000Z')).toBe(1)
    expect(
      deadlineProgress(
        { ...span, status: 'tbd', deadlineAt: undefined },
        '2026-09-05T00:00:00.000Z'
      )
    ).toBeUndefined()
  })

  it('is full when the conference was added at or after its own deadline', () => {
    const late = followedOn('2026-10-05T00:00:00.000Z', '2026-10-01T00:00:00.000Z')
    expect(deadlineProgress(late, '2026-10-06T00:00:00.000Z')).toBe(1)
  })

  it('falls back to when the app first saw a conference that is not followed', () => {
    const unfollowed = view({
      id: 'u',
      title: 'u',
      deadlineAt: '2026-10-01T00:00:00.000Z',
      firstSeenAt: '2026-09-01T00:00:00.000Z'
    })
    expect(deadlineProgress(unfollowed, '2026-09-16T00:00:00.000Z')).toBeCloseTo(0.5, 5)
  })
})
