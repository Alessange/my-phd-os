import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, DEFAULT_UI_STATE } from '../types/settings'
import {
  createCalendarEventInputSchema,
  createCalendarSourceInputSchema,
  icsExportScopeSchema,
  updateCalendarEventInputSchema
} from './calendar'
import {
  colorSchema,
  httpUrlSchema,
  isoDateSchema,
  isoInstantSchema,
  timezoneSchema
} from './common'
import { addSubscriptionRequestSchema, conferenceDeadlineSchema } from './conference'
import { createHabitInputSchema, habitFrequencySchema, setCompletionRequestSchema } from './habit'
import { createMilestoneInputSchema } from './milestone'
import {
  createPersonalDeadlineInputSchema,
  updatePersonalDeadlineInputSchema
} from './personalDeadline'
import { appSettingsSchema, uiStateSchema, updateSettingsInputSchema } from './settings'

describe('common schemas', () => {
  it('validates instants, dates, zones, colors and urls', () => {
    expect(isoInstantSchema.safeParse('2026-09-18T11:59:00.000Z').success).toBe(true)
    expect(isoInstantSchema.safeParse('2026-09-18T11:59:00+02:00').success).toBe(true)
    expect(isoInstantSchema.safeParse('2026-09-18').success).toBe(false)
    expect(isoDateSchema.safeParse('2026-09-18').success).toBe(true)
    expect(isoDateSchema.safeParse('2026-02-30').success).toBe(false)
    expect(timezoneSchema.safeParse('AoE').success).toBe(true)
    expect(timezoneSchema.safeParse('PT').success).toBe(true)
    expect(timezoneSchema.safeParse('Mars/Phobos').success).toBe(false)
    expect(colorSchema.safeParse('#3b82f6').success).toBe(true)
    expect(colorSchema.safeParse('blue').success).toBe(false)
    expect(httpUrlSchema.safeParse('https://ccfddl.com/conference/deadlines_en.ics').success).toBe(
      true
    )
    expect(httpUrlSchema.safeParse('file:///etc/passwd').success).toBe(false)
    expect(httpUrlSchema.safeParse('javascript:alert(1)').success).toBe(false)
  })
})

describe('calendar schemas', () => {
  const timed = {
    title: 'Group meeting',
    startAt: '2026-09-18T16:00:00.000Z',
    endAt: '2026-09-18T17:00:00.000Z',
    timezone: 'PT',
    allDay: false,
    category: 'meeting'
  }

  it('accepts a timed event and defaults sourceManaged to false', () => {
    const parsed = createCalendarEventInputSchema.parse(timed)
    expect(parsed.sourceManaged).toBe(false)
  })

  it('requires dates for all-day events and instants for timed ones', () => {
    expect(
      createCalendarEventInputSchema.safeParse({
        ...timed,
        allDay: true,
        startAt: '2026-09-18',
        endAt: '2026-09-19'
      }).success
    ).toBe(true)
    expect(createCalendarEventInputSchema.safeParse({ ...timed, allDay: true }).success).toBe(false)
    expect(
      createCalendarEventInputSchema.safeParse({
        ...timed,
        startAt: '2026-09-18',
        endAt: '2026-09-19'
      }).success
    ).toBe(false)
  })

  it('rejects an end before the start and an empty title', () => {
    expect(
      createCalendarEventInputSchema.safeParse({ ...timed, endAt: '2026-09-18T15:00:00.000Z' })
        .success
    ).toBe(false)
    expect(createCalendarEventInputSchema.safeParse({ ...timed, title: '   ' }).success).toBe(false)
  })

  it('allows partial updates and strips nothing required', () => {
    expect(updateCalendarEventInputSchema.safeParse({}).success).toBe(true)
    expect(updateCalendarEventInputSchema.safeParse({ category: 'nap' }).success).toBe(false)
  })

  it('defaults new sources to visible', () => {
    expect(
      createCalendarSourceInputSchema.parse({
        name: 'Imported',
        color: '#123456',
        type: 'imported'
      }).visible
    ).toBe(true)
  })

  it('validates export scopes', () => {
    expect(icsExportScopeSchema.safeParse({ type: 'all' }).success).toBe(true)
    expect(icsExportScopeSchema.safeParse({ type: 'events', ids: [] }).success).toBe(false)
    expect(
      icsExportScopeSchema.safeParse({ type: 'range', start: '2026-09-01', end: '2026-09-30' })
        .success
    ).toBe(true)
  })
})

describe('personal deadline schemas', () => {
  const input = {
    title: 'Paper draft',
    trackingStartAt: '2026-09-01T00:00:00.000Z',
    deadlineAt: '2026-09-18T11:59:00.000Z',
    timezone: 'AoE',
    category: 'paper'
  }

  it('applies defaults for status, progress and priority', () => {
    expect(createPersonalDeadlineInputSchema.parse(input)).toMatchObject({
      status: 'not_started',
      progress: 0,
      priority: 'medium'
    })
  })

  it('rejects a tracking start after the deadline and out-of-range progress', () => {
    expect(
      createPersonalDeadlineInputSchema.safeParse({
        ...input,
        trackingStartAt: '2026-10-01T00:00:00.000Z'
      }).success
    ).toBe(false)
    expect(createPersonalDeadlineInputSchema.safeParse({ ...input, progress: 101 }).success).toBe(
      false
    )
    expect(updatePersonalDeadlineInputSchema.safeParse({ progress: -1 }).success).toBe(false)
    expect(updatePersonalDeadlineInputSchema.safeParse({ tags: ['nlp', 'writing'] }).success).toBe(
      true
    )
  })
})

describe('conference schemas', () => {
  it('accepts a TBD deadline without a deadlineAt', () => {
    const now = '2026-09-04T00:00:00.000Z'
    const result = conferenceDeadlineSchema.safeParse({
      id: 'c1',
      subscriptionId: 's1',
      title: 'AAAI 2027 Deadline',
      sourceUrl: 'https://ccfddl.com/conference/deadlines_en.ics',
      status: 'tbd',
      upstreamSnapshotHash: 'abc',
      createdAt: now,
      updatedAt: now,
      stableKey: 's1|aaai|2027|deadline|',
      deadlineKind: 'deadline',
      firstSeenAt: now,
      lastSeenAt: now,
      allDay: false
    })
    expect(result.success).toBe(true)
  })

  it('validates subscription requests', () => {
    expect(
      addSubscriptionRequestSchema.safeParse({
        url: 'https://ccfddl.com/conference/deadlines_en_core_Astar_SE.ics',
        kind: 'official',
        language: 'en',
        filters: { core: 'A*', subject: 'SE' }
      }).success
    ).toBe(true)
    expect(addSubscriptionRequestSchema.safeParse({ url: 'ftp://x', kind: 'custom' }).success).toBe(
      false
    )
    expect(
      addSubscriptionRequestSchema.safeParse({
        url: 'https://x.org/a.ics',
        kind: 'custom',
        filters: { ccf: 'D' }
      }).success
    ).toBe(false)
  })
})

describe('milestone and habit schemas', () => {
  it('defaults milestone status and progress', () => {
    expect(
      createMilestoneInputSchema.parse({
        title: 'Qualifying exam',
        startAt: '2026-09-01T00:00:00.000Z',
        targetAt: '2027-01-15T00:00:00.000Z',
        category: 'phd_progress'
      })
    ).toMatchObject({ status: 'not_started', progress: 0 })
  })

  it('validates habit frequencies', () => {
    expect(habitFrequencySchema.safeParse({ type: 'daily' }).success).toBe(true)
    expect(habitFrequencySchema.safeParse({ type: 'weekly', targetCount: 3 }).success).toBe(true)
    expect(habitFrequencySchema.safeParse({ type: 'weekly', targetCount: 8 }).success).toBe(false)
    expect(habitFrequencySchema.safeParse({ type: 'specific_days', days: [1, 3, 5] }).success).toBe(
      true
    )
    expect(habitFrequencySchema.safeParse({ type: 'specific_days', days: [0] }).success).toBe(false)
    expect(habitFrequencySchema.safeParse({ type: 'specific_days', days: [] }).success).toBe(false)
    expect(
      createHabitInputSchema.safeParse({
        name: 'Reading',
        color: '#22c55e',
        frequency: { type: 'daily' }
      }).success
    ).toBe(true)
    expect(
      setCompletionRequestSchema.safeParse({ habitId: 'h1', date: '2026-09-18', completed: true })
        .success
    ).toBe(true)
    expect(
      setCompletionRequestSchema.safeParse({
        habitId: 'h1',
        date: '2026-09-18T00:00:00Z',
        completed: true
      }).success
    ).toBe(false)
  })
})

describe('settings schemas', () => {
  it('accept the defaults', () => {
    expect(appSettingsSchema.parse(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS)
    expect(uiStateSchema.parse(DEFAULT_UI_STATE)).toEqual(DEFAULT_UI_STATE)
  })

  it('validate partial updates', () => {
    expect(
      updateSettingsInputSchema.safeParse({ timezone: 'Asia/Tokyo', clock: '12h' }).success
    ).toBe(true)
    expect(updateSettingsInputSchema.safeParse({ timezone: 'Nowhere' }).success).toBe(false)
    expect(
      updateSettingsInputSchema.safeParse({ subscriptionRefreshIntervalHours: 0 }).success
    ).toBe(false)
    expect(updateSettingsInputSchema.safeParse({ theme: 'sepia' }).success).toBe(false)
  })
})
