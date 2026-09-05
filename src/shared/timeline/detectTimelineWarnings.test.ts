import { describe, expect, it } from 'vitest'
import type { Milestone } from '../types/milestone'
import type { PersonalDeadline } from '../types/personalDeadline'
import { detectTimelineWarnings } from './detectTimelineWarnings'

// 2026-09-04 is a Friday (ISO weekday 5). Sep 7 is Monday, Sep 9 is Wednesday.
const NOW = '2026-09-04T12:00:00.000Z'
const MON = 1 as const
const SUN = 0 as const

const milestone = (over: Partial<Milestone> & { id: string }): Milestone => ({
  title: 'Milestone',
  startAt: '2026-01-01T00:00:00.000Z',
  targetAt: '2027-06-30T00:00:00.000Z',
  category: 'research',
  status: 'in_progress',
  progress: 50,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  ...over
})

const deadline = (over: Partial<PersonalDeadline> & { id: string }): PersonalDeadline => ({
  title: 'Deadline',
  trackingStartAt: '2026-01-01T00:00:00.000Z',
  deadlineAt: '2027-06-30T00:00:00.000Z',
  timezone: 'UTC',
  category: 'paper',
  priority: 'medium',
  status: 'in_progress',
  progress: 0,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  ...over
})

const rules = (ms: readonly Milestone[], ds: readonly PersonalDeadline[] = []): string[] =>
  detectTimelineWarnings(ms, ds, NOW, MON).map((w) => w.rule)

describe('detectTimelineWarnings', () => {
  it('returns no warnings for a clean, on-track slate', () => {
    const ms = [milestone({ id: 'm1', title: 'Coursework', progress: 50 })]
    expect(detectTimelineWarnings(ms, [], NOW, MON)).toEqual([])
  })

  it('flags a milestone whose start occurs after its target', () => {
    const ms = [
      milestone({
        id: 'm1',
        title: 'Reversed',
        startAt: '2027-12-31T00:00:00.000Z',
        targetAt: '2027-06-30T00:00:00.000Z'
      })
    ]
    const w = detectTimelineWarnings(ms, [], NOW, MON)
    expect(rules(ms)).toEqual(['start_after_target'])
    expect(w[0].milestoneIds).toEqual(['m1'])
    expect(w[0].navigateTo).toEqual({ kind: 'timeline', milestoneId: 'm1' })
  })

  it('flags a milestone past its target that is not complete', () => {
    const ms = [
      milestone({
        id: 'm1',
        title: 'Old',
        startAt: '2026-01-01T00:00:00.000Z',
        targetAt: '2026-06-30T00:00:00.000Z',
        status: 'in_progress',
        progress: 40
      })
    ]
    expect(rules(ms)).toEqual(['milestone_passed_incomplete'])
  })

  it('does not flag a completed milestone even when past its target', () => {
    const ms = [
      milestone({
        id: 'm1',
        title: 'Done',
        startAt: '2026-01-01T00:00:00.000Z',
        targetAt: '2026-06-30T00:00:00.000Z',
        status: 'completed',
        progress: 100
      })
    ]
    expect(detectTimelineWarnings(ms, [], NOW, MON)).toEqual([])
  })

  it('flags time progress substantially exceeding work progress (within the window)', () => {
    const ms = [
      milestone({ id: 'm1', title: 'Lagging', startAt: '2026-01-01T00:00:00.000Z', progress: 0 })
    ]
    const w = detectTimelineWarnings(ms, [], NOW, MON)
    expect(rules(ms)).toEqual(['time_progress_exceeds_work'])
    expect(w[0].detail).toContain('45%')
    expect(w[0].detail).toContain('0%')
  })

  it('does not flag time-progress for a milestone that has already passed (rule 1 instead)', () => {
    const ms = [
      milestone({
        id: 'm1',
        title: 'Late',
        startAt: '2026-01-01T00:00:00.000Z',
        targetAt: '2026-06-30T00:00:00.000Z',
        progress: 0
      })
    ]
    expect(rules(ms)).toEqual(['milestone_passed_incomplete'])
  })

  it('flags a linked deadline scheduled after its milestone target', () => {
    const ms = [
      milestone({ id: 'm1', title: 'Research', targetAt: '2027-06-30T00:00:00.000Z', progress: 50 })
    ]
    const ds = [
      deadline({
        id: 'd1',
        title: 'Paper',
        deadlineAt: '2027-07-15T00:00:00.000Z',
        linkedMilestoneId: 'm1'
      })
    ]
    const w = detectTimelineWarnings(ms, ds, NOW, MON)
    expect(w.map((x) => x.rule)).toEqual(['deadline_after_milestone_target'])
    expect(w[0].deadlineIds).toEqual(['d1'])
    expect(w[0].milestoneIds).toEqual(['m1'])
    expect(w[0].navigateTo).toEqual({ kind: 'personalDeadlines', deadlineId: 'd1' })
  })

  it('groups high-priority deadlines in the same local week (Mon-start)', () => {
    const ds = [
      deadline({ id: 'd1', title: 'A', deadlineAt: '2026-09-07T09:00:00.000Z', priority: 'high' }),
      deadline({
        id: 'd2',
        title: 'B',
        deadlineAt: '2026-09-09T09:00:00.000Z',
        priority: 'critical'
      }),
      deadline({
        id: 'd3',
        title: 'C',
        deadlineAt: '2026-09-08T09:00:00.000Z',
        priority: 'medium'
      }),
      deadline({
        id: 'd4',
        title: 'D',
        deadlineAt: '2026-09-10T09:00:00.000Z',
        priority: 'high',
        status: 'completed'
      })
    ]
    const w = detectTimelineWarnings([], ds, NOW, MON)
    expect(w.map((x) => x.rule)).toEqual(['many_high_priority_deadlines_same_week'])
    expect([...w[0].deadlineIds].sort()).toEqual(['d1', 'd2'])
    expect(w[0].navigateTo.weekStartKey).toBe('2026-09-07')
  })

  it('groups by the configured week-start (Sun vs Mon at the boundary)', () => {
    // Sep 6 2026 is Sunday, Sep 7 is Monday — adjacent across the Sun/Mon boundary.
    const ds = [
      deadline({ id: 'd1', deadlineAt: '2026-09-06T09:00:00.000Z', priority: 'high' }),
      deadline({ id: 'd2', deadlineAt: '2026-09-07T09:00:00.000Z', priority: 'high' })
    ]
    // Monday-start: Sep 6 is in the week of Aug 31, Sep 7 in the week of Sep 7 → split → no warning.
    expect(detectTimelineWarnings([], ds, NOW, MON)).toEqual([])
    // Sunday-start: both fall in the week of Sep 6 → warning.
    const sun = detectTimelineWarnings([], ds, NOW, SUN)
    expect(sun.map((x) => x.rule)).toEqual(['many_high_priority_deadlines_same_week'])
    expect(sun[0].navigateTo.weekStartKey).toBe('2026-09-06')
  })

  it('warns when too many milestones overlap at once (threshold 4)', () => {
    const ms = [
      milestone({
        id: 'm1',
        startAt: '2026-10-01T00:00:00.000Z',
        targetAt: '2027-03-01T00:00:00.000Z',
        progress: 10
      }),
      milestone({
        id: 'm2',
        startAt: '2026-10-15T00:00:00.000Z',
        targetAt: '2027-02-15T00:00:00.000Z',
        progress: 10
      }),
      milestone({
        id: 'm3',
        startAt: '2026-11-01T00:00:00.000Z',
        targetAt: '2027-02-01T00:00:00.000Z',
        progress: 10
      }),
      milestone({
        id: 'm4',
        startAt: '2026-11-15T00:00:00.000Z',
        targetAt: '2027-01-15T00:00:00.000Z',
        progress: 10
      })
    ]
    const overlap = detectTimelineWarnings(ms, [], NOW, MON).find(
      (x) => x.rule === 'too_many_overlapping_milestones'
    )
    expect(overlap).toBeDefined()
    expect(overlap!.milestoneIds).toHaveLength(4)
    expect([...overlap!.milestoneIds].sort()).toEqual(['m1', 'm2', 'm3', 'm4'])
  })

  it('does not warn about too-many-overlap below the threshold (3 overlapping)', () => {
    const ms = [
      milestone({
        id: 'm1',
        startAt: '2026-10-01T00:00:00.000Z',
        targetAt: '2027-03-01T00:00:00.000Z',
        progress: 10
      }),
      milestone({
        id: 'm2',
        startAt: '2026-10-15T00:00:00.000Z',
        targetAt: '2027-02-15T00:00:00.000Z',
        progress: 10
      }),
      milestone({
        id: 'm3',
        startAt: '2026-11-01T00:00:00.000Z',
        targetAt: '2027-02-01T00:00:00.000Z',
        progress: 10
      })
    ]
    expect(
      detectTimelineWarnings(ms, [], NOW, MON).find(
        (x) => x.rule === 'too_many_overlapping_milestones'
      )
    ).toBeUndefined()
  })

  it('flags a significant pairwise overlap', () => {
    const ms = [
      milestone({
        id: 'a',
        title: 'Alpha',
        startAt: '2026-09-10T00:00:00.000Z',
        targetAt: '2026-12-10T00:00:00.000Z',
        progress: 10
      }),
      milestone({
        id: 'b',
        title: 'Beta',
        startAt: '2026-09-20T00:00:00.000Z',
        targetAt: '2026-12-01T00:00:00.000Z',
        progress: 10
      })
    ]
    const w = detectTimelineWarnings(ms, [], NOW, MON)
    expect(w.map((x) => x.rule)).toEqual(['significant_overlap'])
    expect(w[0].milestoneIds).toEqual(['a', 'b'])
  })

  it('ignores a trivial overlap that is too short to be significant', () => {
    const ms = [
      milestone({
        id: 'a',
        title: 'Long',
        startAt: '2026-01-01T00:00:00.000Z',
        targetAt: '2027-06-30T00:00:00.000Z',
        progress: 50
      }),
      milestone({
        id: 'b',
        title: 'Short',
        startAt: '2027-06-20T00:00:00.000Z',
        targetAt: '2027-06-29T00:00:00.000Z',
        progress: 50
      })
    ]
    expect(
      detectTimelineWarnings(ms, [], NOW, MON).find((x) => x.rule === 'significant_overlap')
    ).toBeUndefined()
  })

  it('produces stable ids across re-detection for Dismiss persistence', () => {
    const ms = [
      milestone({
        id: 'm1',
        title: 'Reversed',
        startAt: '2027-12-31T00:00:00.000Z',
        targetAt: '2027-06-30T00:00:00.000Z'
      })
    ]
    const a = detectTimelineWarnings(ms, [], NOW, MON)
    const b = detectTimelineWarnings(ms, [], NOW, MON)
    expect(b.map((x) => x.id)).toEqual(a.map((x) => x.id))
    expect(a[0].id).toBe('start_after_target:m1')
  })
})
