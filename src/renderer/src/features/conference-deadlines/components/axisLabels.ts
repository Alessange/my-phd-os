/**
 * Label layout for the months axis on the Conference tab.
 *
 * Every dated conference gets a name beside its dot, on one of two lanes (above or below the line).
 * Names have very different lengths ("CVPR" next to "CVPR 2027 Rebuttal Submission"), so the lanes
 * are packed by the real width of each name in pixels, never by a fixed share of the axis. When
 * neither lane has room for a full name, the earlier name on the better lane is shortened with an
 * ellipsis; when even that leaves too little, only the dot is drawn (the name stays in the tooltip,
 * the accessible name and the list below). Nothing ever overlaps.
 */
export interface AxisLabelInput {
  id: string
  /** Pixels from the axis' left edge to the dot. */
  x: number
  /** Natural width of the name in pixels, padding included. */
  width: number
}

export interface AxisLabelPlacement {
  id: string
  /** 0 = above the line, 1 = below it. */
  lane: 0 | 1
  /** `start`: the name begins at the dot and runs right; `end`: it ends at the dot and runs left. */
  anchor: 'start' | 'end'
  /** Pixels the name may occupy (an ellipsis follows); `null` means its natural width. */
  maxWidth: number | null
  /** No room even for a shortened name: draw the dot only. */
  hidden: boolean
}

export interface AxisLabelOptions {
  /** Minimum clear pixels between two names on the same lane. */
  gap?: number
  /** Shortest shortened name worth showing. */
  minWidth?: number
  /** The name starts (or ends) this far beside the dot centre. */
  dotOffset?: number
  /** Dots beyond this share of the axis anchor their name to the left of the dot. */
  endFraction?: number
}

interface Slot {
  id: string
  start: number
  end: number
  anchor: 'start' | 'end'
}

export function placeAxisLabels(
  inputs: readonly AxisLabelInput[],
  axisWidth: number,
  options: AxisLabelOptions = {}
): AxisLabelPlacement[] {
  const gap = options.gap ?? 10
  const minWidth = options.minWidth ?? 44
  const offset = options.dotOffset ?? 4
  const endFraction = options.endFraction ?? 0.88

  const result = new Map<string, AxisLabelPlacement>()
  const last: (Slot | null)[] = [null, null]

  const place = (
    lane: 0 | 1,
    id: string,
    anchor: 'start' | 'end',
    start: number,
    end: number,
    maxWidth: number | null
  ): void => {
    result.set(id, { id, lane, anchor, maxWidth, hidden: false })
    last[lane] = { id, start, end, anchor }
  }

  for (const input of [...inputs].sort((a, b) => a.x - b.x)) {
    const anchor = axisWidth > 0 && input.x / axisWidth > endFraction ? 'end' : 'start'
    let start = anchor === 'start' ? input.x - offset : input.x + offset - input.width
    let width = input.width
    let maxWidth: number | null = null
    if (start < 0 && anchor === 'end') {
      // A long name beside a dot near the left edge of the viewport cannot run off the axis.
      width = input.x + offset
      start = 0
      maxWidth = width
    }
    const end = start + width
    if (maxWidth !== null && width < minWidth) {
      result.set(input.id, { id: input.id, lane: 0, anchor, maxWidth: null, hidden: true })
      continue
    }

    const free = ([0, 1] as const).find((lane) => {
      const previous = last[lane]
      return previous === null || start >= previous.end + gap
    })
    if (free !== undefined) {
      place(free, input.id, anchor, start, end, maxWidth)
      continue
    }

    // Neither lane has room for the whole name: let one name give way, if enough of it survives.
    let best: { lane: 0 | 1; shorten: 'previous' | 'current'; width: number } | null = null
    for (const lane of [0, 1] as const) {
      const previous = last[lane]
      if (previous === null) continue
      let candidate: number | null = null
      let shorten: 'previous' | 'current' = 'previous'
      if (anchor === 'start' && previous.anchor === 'start') {
        candidate = start - gap - previous.start
      } else if (anchor === 'end') {
        candidate = end - (previous.end + gap)
        shorten = 'current'
      }
      if (
        candidate !== null &&
        candidate >= minWidth &&
        (best === null || candidate > best.width)
      ) {
        best = { lane, shorten, width: candidate }
      }
    }

    if (best === null) {
      result.set(input.id, { id: input.id, lane: 0, anchor, maxWidth: null, hidden: true })
      continue
    }
    if (best.shorten === 'previous') {
      const previous = last[best.lane] as Slot
      const shortened = result.get(previous.id) as AxisLabelPlacement
      result.set(previous.id, { ...shortened, maxWidth: best.width })
      place(best.lane, input.id, anchor, start, end, maxWidth)
    } else {
      place(best.lane, input.id, anchor, end - best.width, end, best.width)
    }
  }

  return inputs.map((input) => result.get(input.id) as AxisLabelPlacement)
}
