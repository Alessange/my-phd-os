import { describe, expect, it } from 'vitest'
import type { PersonalDeadline } from '../types/personalDeadline'
import {
  collectTags,
  describeDeadlines,
  filterDeadlines,
  nearestUpcomingDeadline,
  sortDeadlines,
  summarizeDeadlines
} from './views'

const NOW = '2026-09-04T12:00:00.000Z'
const DAY = 24 * 60 * 60 * 1000
const at = (days: number): string => new Date(Date.parse(NOW) + days * DAY).toISOString()

const deadline = (over: Partial<PersonalDeadline> & { id: string }): PersonalDeadline => ({
  title: over.id,
  trackingStartAt: at(-20),
  deadlineAt: at(20),
  timezone: 'UTC',
  category: 'paper',
  priority: 'medium',
  status: 'in_progress',
  progress: 50,
  createdAt: at(-30),
  updatedAt: at(-30),
  ...over
})

// Time progress for the default window (−20d … +20d) is 50 %.
const items = describeDeadlines(
  [
    deadline({ id: 'onTrack', progress: 50 }),
    deadline({ id: 'ahead', progress: 90, priority: 'low', tags: ['thesis'] }),
    deadline({ id: 'atRisk', progress: 10, priority: 'critical', tags: ['thesis', 'grant'] }),
    deadline({ id: 'overdue', deadlineAt: at(-1), trackingStartAt: at(-10), progress: 30 }),
    deadline({ id: 'urgent', deadlineAt: at(0.5), trackingStartAt: at(-10), progress: 20 }),
    deadline({ id: 'done', status: 'completed', progress: 100, category: 'course' }),
    deadline({
      id: 'far',
      deadlineAt: at(200),
      trackingStartAt: at(-2),
      progress: 0,
      createdAt: at(-1)
    })
  ],
  NOW
)
const ids = (list: typeof items): string[] => list.map((i) => i.deadline.id)

describe('describeDeadlines', () => {
  it('attaches the centralised status rules to every deadline', () => {
    const byId = Object.fromEntries(items.map((i) => [i.deadline.id, i.computed.status]))
    expect(byId).toEqual({
      onTrack: 'on_track',
      ahead: 'ahead',
      atRisk: 'at_risk',
      overdue: 'overdue',
      urgent: 'urgent',
      done: 'completed',
      far: 'on_track'
    })
  })
})

describe('filterDeadlines', () => {
  it('active hides completed; upcoming also hides past; overdue and completed are exact', () => {
    expect(ids(filterDeadlines(items, { scope: 'active' }))).not.toContain('done')
    expect(ids(filterDeadlines(items, { scope: 'active' }))).toContain('overdue')
    expect(ids(filterDeadlines(items, { scope: 'upcoming' }))).not.toContain('overdue')
    expect(ids(filterDeadlines(items, { scope: 'upcoming' }))).toContain('urgent')
    expect(ids(filterDeadlines(items, { scope: 'overdue' }))).toEqual(['overdue'])
    expect(ids(filterDeadlines(items, { scope: 'completed' }))).toEqual(['done'])
    expect(filterDeadlines(items, { scope: 'all' })).toHaveLength(items.length)
  })

  it('combines category, priority, computed status and tag filters', () => {
    expect(ids(filterDeadlines(items, { scope: 'all', category: 'course' }))).toEqual(['done'])
    expect(ids(filterDeadlines(items, { scope: 'all', priority: 'critical' }))).toEqual(['atRisk'])
    expect(ids(filterDeadlines(items, { scope: 'all', status: 'ahead' }))).toEqual(['ahead'])
    expect(ids(filterDeadlines(items, { scope: 'all', tag: 'thesis' }))).toEqual([
      'ahead',
      'atRisk'
    ])
    expect(ids(filterDeadlines(items, { scope: 'all', tag: 'thesis', priority: 'low' }))).toEqual([
      'ahead'
    ])
  })
})

describe('sortDeadlines', () => {
  it('nearest and farthest order by the deadline instant', () => {
    expect(ids(sortDeadlines(items, 'nearest'))[0]).toBe('overdue')
    expect(ids(sortDeadlines(items, 'farthest'))[0]).toBe('far')
  })

  it('priority puts critical first and breaks ties by nearest', () => {
    const sorted = ids(sortDeadlines(items, 'priority'))
    expect(sorted[0]).toBe('atRisk')
    expect(sorted[sorted.length - 1]).toBe('ahead') // the only `low`
  })

  it('progress puts the least-done first', () => {
    expect(ids(sortDeadlines(items, 'progress'))[0]).toBe('far')
  })

  it('risk orders overdue, urgent, at risk, behind, on track, ahead, completed', () => {
    const sorted = ids(sortDeadlines(items, 'risk'))
    expect(sorted.slice(0, 3)).toEqual(['overdue', 'urgent', 'atRisk'])
    expect(sorted[sorted.length - 1]).toBe('done')
    expect(sorted.indexOf('ahead')).toBeGreaterThan(sorted.indexOf('onTrack'))
  })

  it('recent puts the newest first', () => {
    expect(ids(sortDeadlines(items, 'recent'))[0]).toBe('far')
  })

  it('does not mutate its input', () => {
    const before = ids(items)
    sortDeadlines(items, 'farthest')
    expect(ids(items)).toEqual(before)
  })
})

describe('collectTags / nearestUpcomingDeadline / summarizeDeadlines', () => {
  it('collects unique sorted tags', () => {
    expect(collectTags(items.map((i) => i.deadline))).toEqual(['grant', 'thesis'])
  })

  it('finds the nearest deadline that is neither completed nor past', () => {
    expect(nearestUpcomingDeadline(items)?.deadline.id).toBe('urgent')
    expect(nearestUpcomingDeadline([])).toBeUndefined()
  })

  it('summarises counts for the deadline summary', () => {
    // Week end 3 days out: `urgent` (12 h) is due this week, `onTrack` (20 d) is not.
    const summary = summarizeDeadlines(items, at(3))
    expect(summary).toMatchObject({ active: 6, dueThisWeek: 1, atRisk: 3, completed: 1 })
    expect(summary.nearest?.deadline.id).toBe('urgent')
  })
})
