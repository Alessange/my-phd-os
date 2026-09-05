import { describe, expect, it } from 'vitest'
import type { PersonalDeadline } from '../types/personalDeadline'
import {
  buildLinkedEventInput,
  linkModeOf,
  linkedEventPatch,
  linkedEventTimes
} from './calendarLink'

// 23:59 on Sep 17 in Los Angeles (PDT, UTC−7) is 06:59 UTC on Sep 18.
const deadline: PersonalDeadline = {
  id: 'd1',
  title: 'Submit paper',
  description: 'Camera-ready',
  trackingStartAt: '2026-09-01T00:00:00.000Z',
  deadlineAt: '2026-09-18T06:59:00.000Z',
  timezone: 'America/Los_Angeles',
  category: 'paper',
  priority: 'high',
  status: 'in_progress',
  progress: 40,
  sourceUrl: 'https://example.org/cfp',
  location: 'Online',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z'
}

describe('linkedEventTimes', () => {
  it('all-day mode covers the deadline’s local day in its own zone, end exclusive', () => {
    expect(linkedEventTimes(deadline, 'allDay')).toEqual({
      startAt: '2026-09-17',
      endAt: '2026-09-18',
      allDay: true,
      timezone: 'America/Los_Angeles'
    })
  })

  it('exact mode is a point event at the deadline instant', () => {
    expect(linkedEventTimes(deadline, 'exact')).toEqual({
      startAt: '2026-09-18T06:59:00.000Z',
      endAt: '2026-09-18T06:59:00.000Z',
      allDay: false,
      timezone: 'America/Los_Angeles'
    })
  })

  it('AoE deadlines land on the AoE calendar date', () => {
    // 23:59 AoE (UTC−12) on Sep 18 is 11:59 UTC on Sep 19.
    expect(
      linkedEventTimes({ deadlineAt: '2026-09-19T11:59:00.000Z', timezone: 'AoE' }, 'allDay')
    ).toMatchObject({ startAt: '2026-09-18', endAt: '2026-09-19' })
  })
})

describe('buildLinkedEventInput', () => {
  it('copies the deadline’s identity into a non-source-managed deadline event with a back-link', () => {
    expect(buildLinkedEventInput(deadline, 'allDay')).toEqual({
      title: 'Submit paper',
      description: 'Camera-ready',
      location: 'Online',
      url: 'https://example.org/cfp',
      startAt: '2026-09-17',
      endAt: '2026-09-18',
      allDay: true,
      timezone: 'America/Los_Angeles',
      category: 'deadline',
      linkedPersonalDeadlineId: 'd1',
      sourceManaged: false
    })
  })
})

describe('linkedEventPatch', () => {
  it('keeps the existing event’s mode by default', () => {
    const patch = linkedEventPatch({ ...deadline, title: 'Renamed' }, { allDay: false })
    expect(patch).toMatchObject({
      title: 'Renamed',
      startAt: '2026-09-18T06:59:00.000Z',
      allDay: false,
      linkedPersonalDeadlineId: 'd1'
    })
  })

  it('switches mode when one is requested', () => {
    expect(linkedEventPatch(deadline, { allDay: false }, 'allDay')).toMatchObject({
      startAt: '2026-09-17',
      endAt: '2026-09-18',
      allDay: true
    })
  })

  it('derives the mode from the event', () => {
    expect(linkModeOf({ allDay: true })).toBe('allDay')
    expect(linkModeOf({ allDay: false })).toBe('exact')
  })
})
