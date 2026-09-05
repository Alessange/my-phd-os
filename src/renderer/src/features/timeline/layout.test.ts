import { describe, expect, it } from 'vitest'
import type { Milestone } from '@shared/types/milestone'
import {
  axisTicks,
  barLayout,
  computeTimelineWindow,
  markerInBar,
  nowFractionInWindow,
  packLanes,
  type TimelineWindow
} from './layout'

const NOW = '2026-09-04T12:00:00.000Z'
const NOW_MS = Date.parse(NOW)
const DAY = 24 * 60 * 60 * 1000
const at = (offsetDays: number): string => new Date(NOW_MS + offsetDays * DAY).toISOString()

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

describe('computeTimelineWindow', () => {
  it('returns null for the list view (no span to position against)', () => {
    expect(computeTimelineWindow([], NOW, 'list')).toBeNull()
  })

  it('anchors the semester view on now (60d back, 120d forward)', () => {
    const w = computeTimelineWindow([], NOW, 'semester') as TimelineWindow
    expect(w.startMs).toBe(NOW_MS - 60 * DAY)
    expect(w.endMs).toBe(NOW_MS + 120 * DAY)
  })

  it('anchors the year view on now (90d back, 275d forward)', () => {
    const w = computeTimelineWindow([], NOW, 'year') as TimelineWindow
    expect(w.startMs).toBe(NOW_MS - 90 * DAY)
    expect(w.endMs).toBe(NOW_MS + 275 * DAY)
  })

  it('shifts anchored views by whole spans with the range offset', () => {
    const base = computeTimelineWindow([], NOW, 'semester') as TimelineWindow
    const next = computeTimelineWindow([], NOW, 'semester', 1) as TimelineWindow
    const prev = computeTimelineWindow([], NOW, 'semester', -1) as TimelineWindow
    expect(next.startMs).toBe(base.startMs + 180 * DAY)
    expect(next.endMs).toBe(base.endMs + 180 * DAY)
    expect(prev.endMs).toBe(base.startMs)
  })

  it('spans the full data extent for multi-year, with 14d padding each side', () => {
    const ms = [
      milestone({
        id: 'a',
        startAt: '2026-01-01T00:00:00.000Z',
        targetAt: '2027-06-30T00:00:00.000Z'
      }),
      milestone({
        id: 'b',
        startAt: '2024-09-01T00:00:00.000Z',
        targetAt: '2030-03-01T00:00:00.000Z'
      })
    ]
    const w = computeTimelineWindow(ms, NOW, 'multiYear') as TimelineWindow
    expect(w.startMs).toBe(Date.parse('2024-09-01T00:00:00.000Z') - 14 * DAY)
    expect(w.endMs).toBe(Date.parse('2030-03-01T00:00:00.000Z') + 14 * DAY)
  })

  it('always includes today in the multi-year extent', () => {
    const past = [milestone({ id: 'a', startAt: at(-800), targetAt: at(-700) })]
    const w = computeTimelineWindow(past, NOW, 'multiYear') as TimelineWindow
    expect(w.startMs).toBeLessThanOrEqual(NOW_MS - 800 * DAY)
    expect(w.endMs).toBeGreaterThanOrEqual(NOW_MS)
  })

  it('never zooms multi-year below a year: an empty plan is a year centred on today', () => {
    const w = computeTimelineWindow([], NOW, 'multiYear') as TimelineWindow
    expect(w.endMs - w.startMs).toBe(365 * DAY)
    expect((w.startMs + w.endMs) / 2).toBe(NOW_MS)
  })
})

describe('barLayout', () => {
  const window: TimelineWindow = { startMs: NOW_MS - 60 * DAY, endMs: NOW_MS + 120 * DAY }
  const span = window.endMs - window.startMs // 180d

  it('positions a bar fully inside the window and reports work fill + today tick', () => {
    // A milestone straddling now: 30d before now → 30d after now, progress 40%.
    const m = milestone({ id: 'm1', startAt: at(-30), targetAt: at(30), progress: 40 })
    const lay = barLayout(m, window, NOW)
    expect(lay.left).toBeCloseTo((30 * DAY) / span, 6) // start is 30d after window start
    expect(lay.width).toBeCloseTo((60 * DAY) / span, 6)
    expect(lay.workFraction).toBeCloseTo(0.4, 6)
    expect(lay.nowFraction).toBeCloseTo(0.5, 6) // now is exactly mid-bar
    expect(lay.inWindow).toBe(true)
    expect(lay.clippedStart).toBe(false)
    expect(lay.clippedEnd).toBe(false)
  })

  it('keeps the today tick aligned with the global marker when the bar is clipped', () => {
    // Starts 120d before the window opens, ends 30d after now: the visible bar is [0, 90d/180d].
    const m = milestone({ id: 'm1', startAt: at(-180), targetAt: at(30), progress: 0 })
    const lay = barLayout(m, window, NOW)
    expect(lay.clippedStart).toBe(true)
    expect(lay.left).toBe(0)
    expect(lay.width).toBeCloseTo((90 * DAY) / span, 6)
    // Today is 60d into a 90d visible bar → 2/3, which is also the global now fraction ÷ width.
    expect(lay.nowFraction).toBeCloseTo(2 / 3, 6)
    expect(lay.nowFraction! * lay.width).toBeCloseTo(nowFractionInWindow(NOW, window)!, 6)
  })

  it('measures the work fill on the full span and clips it with the bar', () => {
    // 210d milestone starting 180d before now; 50 % done → fill ends 105d after start, i.e. 75d
    // before now, which is 15d before the window opens → nothing of the fill is visible.
    const early = milestone({ id: 'e', startAt: at(-180), targetAt: at(30), progress: 50 })
    expect(barLayout(early, window, NOW).workFraction).toBe(0)
    // Same milestone at 90 % → fill ends 189d after start = 9d after now = 69d into a 90d visible bar.
    const late = milestone({ id: 'l', startAt: at(-180), targetAt: at(30), progress: 90 })
    expect(barLayout(late, window, NOW).workFraction).toBeCloseTo(69 / 90, 6)
  })

  it('reports a null today tick when now is before the milestone starts', () => {
    const m = milestone({ id: 'm1', startAt: at(40), targetAt: at(80), progress: 0 })
    expect(barLayout(m, window, NOW).nowFraction).toBeNull()
  })

  it('reports a null today tick when now is after the milestone target', () => {
    const m = milestone({ id: 'm1', startAt: at(-120), targetAt: at(-70), progress: 100 })
    expect(barLayout(m, window, NOW).nowFraction).toBeNull()
  })

  it('marks a milestone entirely outside the window as not in-window (width 0)', () => {
    const m = milestone({ id: 'm1', startAt: at(300), targetAt: at(400), progress: 0 })
    const lay = barLayout(m, window, NOW)
    expect(lay.inWindow).toBe(false)
    expect(lay.width).toBe(0)
  })

  it('clamps work fraction to [0,1]', () => {
    const over = { id: 'm1', startAt: at(-10), targetAt: at(10) }
    expect(barLayout(milestone({ ...over, progress: -5 }), window, NOW).workFraction).toBe(0)
    expect(barLayout(milestone({ ...over, progress: 150 }), window, NOW).workFraction).toBe(1)
  })
})

describe('markerInBar', () => {
  const window: TimelineWindow = { startMs: NOW_MS - 60 * DAY, endMs: NOW_MS + 120 * DAY }
  const bar = barLayout(milestone({ id: 'm', startAt: at(-30), targetAt: at(30) }), window, NOW)

  it('places an instant inside the bar proportionally', () => {
    const marker = markerInBar(at(15), bar, window)
    expect(marker?.outside).toBe(false)
    expect(marker?.fraction).toBeCloseTo(0.75, 9)
  })

  it('treats the exact target instant as inside (fraction 1)', () => {
    expect(markerInBar(at(30), bar, window)).toEqual({ fraction: 1, outside: false })
  })

  it('pins an instant past the target to the right edge and flags it', () => {
    expect(markerInBar(at(45), bar, window)).toEqual({ fraction: 1, outside: true })
  })

  it('pins an instant before the start to the left edge and flags it', () => {
    expect(markerInBar(at(-45), bar, window)).toEqual({ fraction: 0, outside: true })
  })

  it('returns null for a bar with no visible width', () => {
    expect(markerInBar(NOW, { left: 0.2, width: 0 }, window)).toBeNull()
  })
})

describe('nowFractionInWindow', () => {
  const window: TimelineWindow = { startMs: NOW_MS - 60 * DAY, endMs: NOW_MS + 120 * DAY }

  it('places now at the correct fraction of the window', () => {
    expect(nowFractionInWindow(NOW, window)).toBeCloseTo(60 / 180, 6)
  })

  it('returns null when now is before the window', () => {
    expect(nowFractionInWindow(at(-100), window)).toBeNull()
  })

  it('returns null when now is after the window', () => {
    expect(nowFractionInWindow(at(200), window)).toBeNull()
  })
})

describe('packLanes', () => {
  it('gives non-overlapping milestones one lane', () => {
    const plan = packLanes([
      milestone({ id: 'a', startAt: at(0), targetAt: at(10) }),
      milestone({ id: 'b', startAt: at(10), targetAt: at(20) }), // starts exactly when a ends
      milestone({ id: 'c', startAt: at(25), targetAt: at(30) })
    ])
    expect(plan.count).toBe(1)
    expect([...plan.laneOf.values()]).toEqual([0, 0, 0])
  })

  it('moves overlapping milestones to further lanes and reuses freed ones', () => {
    const plan = packLanes([
      milestone({ id: 'a', startAt: at(0), targetAt: at(30) }),
      milestone({ id: 'b', startAt: at(5), targetAt: at(10) }), // overlaps a → lane 1
      milestone({ id: 'c', startAt: at(12), targetAt: at(20) }), // b ended → back to lane 1
      milestone({ id: 'd', startAt: at(15), targetAt: at(18) }) // overlaps a and c → lane 2
    ])
    expect(plan.count).toBe(3)
    expect(plan.laneOf.get('a')).toBe(0)
    expect(plan.laneOf.get('b')).toBe(1)
    expect(plan.laneOf.get('c')).toBe(1)
    expect(plan.laneOf.get('d')).toBe(2)
  })

  it('reports one lane for an empty track', () => {
    expect(packLanes([]).count).toBe(1)
  })
})

describe('axisTicks', () => {
  it('returns no ticks for the list view', () => {
    expect(axisTicks({ startMs: 0, endMs: 1 }, 'list', 'UTC', 1)).toEqual([])
  })

  it('labels the twelve month boundaries inside a year window and adds no minors', () => {
    const w = computeTimelineWindow([], NOW, 'year') as TimelineWindow
    const ticks = axisTicks(w, 'year', 'UTC', 1)
    const majors = ticks.filter((t) => t.major)
    expect(majors).toHaveLength(12)
    expect(majors[0].label).toBe('Jul 2026')
    expect(majors[11].label).toBe('Jun 2027')
    expect(majors.every((t) => t.ms >= w.startMs && t.ms <= w.endMs)).toBe(true)
    expect(ticks.filter((t) => !t.major)).toHaveLength(0)
  })

  it('adds unlabelled weekly minors on the configured week start for the semester view', () => {
    const w = computeTimelineWindow([], NOW, 'semester') as TimelineWindow
    const mondays = axisTicks(w, 'semester', 'UTC', 1).filter((t) => !t.major)
    expect(mondays.length).toBeGreaterThan(20)
    expect(mondays.every((t) => t.label === '' && new Date(t.ms).getUTCDay() === 1)).toBe(true)
    const sundays = axisTicks(w, 'semester', 'UTC', 0).filter((t) => !t.major)
    expect(sundays.every((t) => new Date(t.ms).getUTCDay() === 0)).toBe(true)
  })

  it('labels year boundaries and adds quarterly minors for multi-year', () => {
    const ms = [
      milestone({
        id: 'a',
        startAt: '2024-09-01T00:00:00.000Z',
        targetAt: '2030-03-01T00:00:00.000Z'
      })
    ]
    const w = computeTimelineWindow(ms, NOW, 'multiYear') as TimelineWindow
    const ticks = axisTicks(w, 'multiYear', 'UTC', 1)
    expect(ticks.filter((t) => t.major).map((t) => t.label)).toEqual([
      '2025',
      '2026',
      '2027',
      '2028',
      '2029',
      '2030'
    ])
    expect(ticks.filter((t) => !t.major).length).toBeGreaterThan(0)
  })

  it('computes boundaries in the display zone', () => {
    const w = computeTimelineWindow([], NOW, 'year') as TimelineWindow
    const utc = axisTicks(w, 'year', 'UTC', 1).filter((t) => t.major)[0]
    const tokyo = axisTicks(w, 'year', 'Asia/Tokyo', 1).filter((t) => t.major)[0]
    // Midnight Jul 1 in Tokyo is 15:00 Jun 30 UTC: nine hours earlier than midnight UTC.
    expect(utc.ms - tokyo.ms).toBe(9 * 60 * 60 * 1000)
  })
})
