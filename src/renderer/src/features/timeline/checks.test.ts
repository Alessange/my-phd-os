import { describe, expect, it } from 'vitest'
import type { TimelineWarning } from '@shared/timeline/detectTimelineWarnings'
import type { Milestone } from '@shared/types/milestone'
import { conciseDetail, sortWarnings, summarizeWarnings, titleSegments } from './checks'

const warning = (over: Partial<TimelineWarning> & { id: string }): TimelineWarning => ({
  rule: 'significant_overlap',
  title: 'title',
  detail: 'detail',
  milestoneIds: [],
  deadlineIds: [],
  navigateTo: { kind: 'timeline' },
  ...over
})

const milestone = (id: string, title: string, over: Partial<Milestone> = {}): Milestone => ({
  id,
  title,
  startAt: '2026-01-01T00:00:00.000Z',
  targetAt: '2026-11-17T01:00:00.000Z',
  category: 'research',
  status: 'in_progress',
  progress: 10,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over
})

describe('summarizeWarnings', () => {
  it('counts the open checks and groups them by rule in a fixed order', () => {
    const list = [
      warning({ id: '1' }),
      warning({ id: '2' }),
      warning({ id: '3', rule: 'milestone_passed_incomplete' }),
      warning({ id: '4' })
    ]
    expect(summarizeWarnings(list)).toBe('4 open · 1 past target · 3 overlaps')
    expect(summarizeWarnings([warning({ id: '1' })])).toBe('1 open · 1 overlap')
  })
})

describe('sortWarnings', () => {
  it('puts things to fix first and orders the rest by title, not by id', () => {
    const sorted = sortWarnings([
      warning({ id: 'z', title: 'B pair' }),
      warning({ id: 'a', title: 'A pair' }),
      warning({ id: 'm', rule: 'milestone_passed_incomplete', title: 'Late' })
    ])
    expect(sorted.map((w) => w.title)).toEqual(['Late', 'A pair', 'B pair'])
  })
})

describe('conciseDetail', () => {
  it('drops the names the title already carries', () => {
    expect(conciseDetail('"A" and "B" run concurrently for 80 days.')).toBe(
      'Run concurrently for 80 days.'
    )
    expect(conciseDetail('"Old" was targeted for Nov 17, 2026 and is still delayed.')).toBe(
      'Targeted for Nov 17, 2026 and is still delayed.'
    )
    expect(conciseDetail('3 milestones are active during the same period.')).toBe(
      '3 milestones are active during the same period.'
    )
  })
})

describe('titleSegments', () => {
  const list = [milestone('a', 'Paper 2 draft'), milestone('b', 'Internship')]

  it('splits a pair title so each milestone name is its own segment', () => {
    const w = warning({ id: 'p', milestoneIds: ['a', 'b'] })
    expect(
      titleSegments('"Paper 2 draft" and "Internship" overlap significantly', w, list)
    ).toEqual([
      { text: '"Paper 2 draft"', milestoneId: 'a' },
      { text: ' and ' },
      { text: '"Internship"', milestoneId: 'b' },
      { text: ' overlap significantly' }
    ])
  })

  it('leaves a single-milestone title in one piece', () => {
    const w = warning({ id: 's', milestoneIds: ['a'] })
    expect(titleSegments('"Paper 2 draft" is late', w, list)).toEqual([
      { text: '"Paper 2 draft" is late' }
    ])
  })
})
