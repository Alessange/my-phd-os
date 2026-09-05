import { describe, expect, it } from 'vitest'
import { packPointLanes, pointInWindow, type TimelineWindow } from './layout'

const DAY = 24 * 60 * 60 * 1000
const window: TimelineWindow = {
  startMs: Date.parse('2026-09-01T00:00:00.000Z'),
  endMs: Date.parse('2026-09-01T00:00:00.000Z') + 100 * DAY
}

describe('pointInWindow', () => {
  it('positions an instant proportionally across the window', () => {
    expect(pointInWindow('2026-09-26T00:00:00.000Z', window)).toBeCloseTo(0.25, 6)
    expect(pointInWindow('2026-09-01T00:00:00.000Z', window)).toBe(0)
    expect(pointInWindow(new Date(window.endMs).toISOString(), window)).toBe(1)
  })

  it('returns null for instants outside the window or unparsable values', () => {
    expect(pointInWindow('2026-08-31T23:59:59.000Z', window)).toBeNull()
    expect(pointInWindow('2027-01-01T00:00:00.000Z', window)).toBeNull()
    expect(pointInWindow('not a date', window)).toBeNull()
  })
})

describe('packPointLanes', () => {
  it('keeps well-separated markers on one lane', () => {
    const plan = packPointLanes(
      [
        { id: 'a', fraction: 0.1 },
        { id: 'b', fraction: 0.5 },
        { id: 'c', fraction: 0.9 }
      ],
      0.12
    )
    expect(plan.count).toBe(1)
    expect([...plan.laneOf.values()]).toEqual([0, 0, 0])
  })

  it('moves colliding markers to further lanes and reuses lanes once there is room', () => {
    const plan = packPointLanes(
      [
        { id: 'a', fraction: 0.1 },
        { id: 'b', fraction: 0.15 },
        { id: 'c', fraction: 0.18 },
        { id: 'd', fraction: 0.6 }
      ],
      0.12
    )
    expect(plan.count).toBe(3)
    expect(plan.laneOf.get('a')).toBe(0)
    expect(plan.laneOf.get('b')).toBe(1)
    expect(plan.laneOf.get('c')).toBe(2)
    expect(plan.laneOf.get('d')).toBe(0)
  })

  it('reports one lane for no markers', () => {
    expect(packPointLanes([], 0.1)).toEqual({ laneOf: new Map(), count: 1 })
  })
})
