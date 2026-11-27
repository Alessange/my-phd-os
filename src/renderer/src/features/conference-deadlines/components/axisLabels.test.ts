import { describe, expect, it } from 'vitest'
import { placeAxisLabels, type AxisLabelInput, type AxisLabelPlacement } from './axisLabels'

/** Rough width of a 13 px Linux Biolinum name, padding included (what the board measures). */
const w = (text: string): number => Math.ceil(text.length * 6.2) + 4

/** Pixel interval the name occupies on its lane once placed. */
const interval = (input: AxisLabelInput, p: AxisLabelPlacement): [number, number] => {
  const width = Math.min(input.width, p.maxWidth ?? input.width)
  const start = p.anchor === 'start' ? input.x - 4 : input.x + 4 - width
  return [start, start + width]
}

const overlaps = (inputs: AxisLabelInput[], placements: AxisLabelPlacement[]): string[] => {
  const bad: string[] = []
  const shown = placements.filter((p) => !p.hidden)
  for (let i = 0; i < shown.length; i++) {
    for (let j = i + 1; j < shown.length; j++) {
      const a = shown[i] as AxisLabelPlacement
      const b = shown[j] as AxisLabelPlacement
      if (a.lane !== b.lane) continue
      const [a0, a1] = interval(inputs.find((x) => x.id === a.id) as AxisLabelInput, a)
      const [b0, b1] = interval(inputs.find((x) => x.id === b.id) as AxisLabelInput, b)
      if (a0 < b1 && b0 < a1) bad.push(`${a.id} x ${b.id}`)
    }
  }
  return bad
}

describe('placeAxisLabels', () => {
  it('lays out the four long names that used to overlap on a 1200 px axis', () => {
    // Positions follow the owner's screenshot: Feb, mid-Feb, end of Feb and May.
    const names: [string, number][] = [
      ['CVPR 2027 Rebuttal Submission', 210],
      ['RSS 2027 Rebuttal Submission', 330],
      ['CVPR 2027 Final Decisions', 515],
      ['RSS 2027 Final Decisions', 1115]
    ]
    const inputs = names.map(([id, x]) => ({ id, x, width: w(id) }))
    const placements = placeAxisLabels(inputs, 1200)
    expect(overlaps(inputs, placements)).toEqual([])
    // Every name is either shown (possibly shortened) or deliberately dot-only.
    expect(placements.every((p) => p.hidden || p.maxWidth === null || p.maxWidth >= 44)).toBe(true)
  })

  it('keeps short names whole, alternating lanes only when they would touch', () => {
    const inputs = [
      { id: 'CVPR', x: 40, width: w('CVPR') },
      { id: 'ICML', x: 55, width: w('ICML') },
      { id: 'SIGGRAPH', x: 400, width: w('SIGGRAPH') }
    ]
    const placements = placeAxisLabels(inputs, 1200)
    expect(placements.map((p) => p.maxWidth)).toEqual([null, null, null])
    expect(placements[0]?.lane).not.toBe(placements[1]?.lane)
    expect(overlaps(inputs, placements)).toEqual([])
  })

  it('shortens the earlier name before it would run into the next one on the same lane', () => {
    const inputs = [
      { id: 'a', x: 20, width: 300 },
      { id: 'b', x: 60, width: 300 },
      { id: 'c', x: 200, width: 120 }
    ]
    const placements = placeAxisLabels(inputs, 1200)
    expect(overlaps(inputs, placements)).toEqual([])
    expect(placements.some((p) => p.maxWidth !== null)).toBe(true)
  })

  it('draws only the dot when not even a shortened name fits', () => {
    const inputs = Array.from({ length: 8 }, (_, i) => ({
      id: `c${i}`,
      x: 100 + i * 8,
      width: 150
    }))
    const placements = placeAxisLabels(inputs, 1200)
    expect(overlaps(inputs, placements)).toEqual([])
    expect(placements.some((p) => p.hidden)).toBe(true)
    expect(placements.filter((p) => !p.hidden).length).toBeGreaterThan(0)
  })

  it('anchors names beside dots near the right edge to the left of the dot', () => {
    const inputs = [{ id: 'RSS 2027 Final Decisions', x: 1150, width: 160 }]
    const [p] = placeAxisLabels(inputs, 1200)
    expect(p?.anchor).toBe('end')
    expect(p?.hidden).toBe(false)
  })

  it('never lets a long right-anchored name run off the left edge of a small axis', () => {
    const inputs = [{ id: 'long', x: 260, width: 400 }]
    const [p] = placeAxisLabels(inputs, 280)
    expect(p?.anchor).toBe('end')
    expect(p?.maxWidth).not.toBeNull()
    expect((p?.maxWidth ?? 0) <= 264).toBe(true)
  })

  it('returns one placement per input, in input order', () => {
    const inputs = [
      { id: 'late', x: 700, width: 60 },
      { id: 'early', x: 10, width: 60 }
    ]
    expect(placeAxisLabels(inputs, 1200).map((p) => p.id)).toEqual(['late', 'early'])
    expect(placeAxisLabels([], 1200)).toEqual([])
  })
})
