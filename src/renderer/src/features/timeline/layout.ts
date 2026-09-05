import { DateTime } from 'luxon'
import { compareInstants, parseInstant, resolveZone, type ZoneInput } from '@shared/dates'
/** Anything drawn as a bar: milestones, or personal deadlines mapped from tracking start to deadline. */
export interface TimeSpan {
  id: string
  title: string
  startAt: string
  targetAt: string
  progress: number
}

/** The four timeline views (spec §15.1). `list` is a chronological table, the rest are Gantts. */
export type TimelineViewKind = 'semester' | 'year' | 'multiYear' | 'list'
export type GanttViewKind = Exclude<TimelineViewKind, 'list'>

export interface TimelineWindow {
  startMs: number
  endMs: number
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Days shown before and after `now` in the now-anchored views (at range offset 0). */
const ANCHORED_SPANS: Record<'semester' | 'year', { back: number; forward: number }> = {
  semester: { back: 60, forward: 120 },
  year: { back: 90, forward: 275 }
}
/** Multi-year never zooms below a year and pads the data extent so edge bars are not flush. */
const MULTI_YEAR_MIN_DAYS = 365
const MULTI_YEAR_PAD_DAYS = 14

/**
 * Visible time span for a Gantt view. Semester and year are anchored on `now` and shift by whole
 * spans with `offset` (the range controls); multi-year spans the full extent of the data plus
 * today, so no milestone is ever clipped. `list` has no span: it lays rows out chronologically.
 */
export const computeTimelineWindow = (
  milestones: readonly TimeSpan[],
  nowIso: string,
  view: TimelineViewKind,
  offset = 0
): TimelineWindow | null => {
  if (view === 'list') return null
  const nowMs = parseInstant(nowIso).toMillis()
  if (view === 'multiYear')
    return extentWindow(milestones, nowIso, {
      minDays: MULTI_YEAR_MIN_DAYS,
      padDays: MULTI_YEAR_PAD_DAYS
    })
  const { back, forward } = ANCHORED_SPANS[view]
  const shift = offset * (back + forward) * DAY_MS
  return { startMs: nowMs - back * DAY_MS + shift, endMs: nowMs + forward * DAY_MS + shift }
}

/**
 * Window covering every span plus today, padded by `padDays` and never shorter than `minDays`
 * (centred when the data is narrower). Used by the multi-year view and the deadline timeline.
 */
export const extentWindow = (
  spans: readonly TimeSpan[],
  nowIso: string,
  options: { minDays: number; padDays: number }
): TimelineWindow => {
  const nowMs = parseInstant(nowIso).toMillis()
  let start = nowMs
  let end = nowMs
  for (const span of spans) {
    const s = parseInstant(span.startAt).toMillis()
    const t = parseInstant(span.targetAt).toMillis()
    start = Math.min(start, s, t)
    end = Math.max(end, s, t)
  }
  start -= options.padDays * DAY_MS
  end += options.padDays * DAY_MS
  const shortfall = options.minDays * DAY_MS - (end - start)
  if (shortfall > 0) {
    start -= shortfall / 2
    end += shortfall / 2
  }
  return { startMs: start, endMs: end }
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)
const EPSILON = 1e-9

/** Position of an instant (ms) inside the window as a fraction; may fall outside [0, 1]. */
const windowFraction = (ms: number, window: TimelineWindow): number =>
  (ms - window.startMs) / (window.endMs - window.startMs)

export interface BarLayout {
  /** Left edge of the visible (window-clipped) bar as a window fraction. */
  left: number
  /** Width of the visible bar as a window fraction (0 when nothing is visible). */
  width: number
  /**
   * Work-progress fill as a fraction of the visible bar. Measured on the milestone's full span and
   * then clipped, so a bar cut by the window edge still shows the fill at the correct date.
   */
  workFraction: number
  /**
   * Today's position as a fraction of the visible bar, aligned with the global current-date line;
   * null when today is outside the milestone.
   */
  nowFraction: number | null
  clippedStart: boolean
  clippedEnd: boolean
  /** Whether any part of the bar intersects the window (false: hide the bar). */
  inWindow: boolean
}

export interface BarMarker {
  /** Position along the visible bar, 0–1. */
  fraction: number
  /** True when the instant lies beyond the visible bar and was pinned to the nearer edge. */
  outside: boolean
}

/**
 * Where an instant sits along a visible bar. Instants beyond the bar pin to the nearer edge with
 * `outside: true` (a linked deadline after the target stays visible, rendered differently); null
 * when the bar has no visible width.
 */
export const markerInBar = (
  instantIso: string,
  layout: Pick<BarLayout, 'left' | 'width'>,
  window: TimelineWindow
): BarMarker | null => {
  if (layout.width <= 0) return null
  const f = windowFraction(parseInstant(instantIso).toMillis(), window)
  const right = layout.left + layout.width
  if (f < layout.left - EPSILON) return { fraction: 0, outside: true }
  if (f > right + EPSILON) return { fraction: 1, outside: true }
  return { fraction: clamp01((f - layout.left) / layout.width), outside: false }
}

/**
 * Position of one milestone's bar within a window, plus its work fill and today tick. The tick
 * versus the fill is the spec's "time has progressed to here, work has progressed to here": the
 * gap reads as ahead (fill past the tick) or behind (tick past the fill).
 */
export const barLayout = (span: TimeSpan, window: TimelineWindow, nowIso: string): BarLayout => {
  const startMs = parseInstant(span.startAt).toMillis()
  const endMs = parseInstant(span.targetAt).toMillis()
  const fullLeft = windowFraction(startMs, window)
  const fullRight = windowFraction(endMs, window)
  const left = clamp01(fullLeft)
  const right = clamp01(fullRight)
  const width = Math.max(0, right - left)
  const inWindow = width > 0 && endMs > window.startMs && startMs < window.endMs
  const workEnd = fullLeft + clamp01(span.progress / 100) * Math.max(0, fullRight - fullLeft)
  const workFraction = width > 0 ? clamp01((workEnd - left) / width) : 0
  const now = markerInBar(nowIso, { left, width }, window)
  return {
    left,
    width,
    workFraction,
    nowFraction: now && !now.outside ? now.fraction : null,
    clippedStart: inWindow && fullLeft < 0,
    clippedEnd: inWindow && fullRight > 1,
    inWindow
  }
}

/** Position of the global current-date marker as a window fraction, or null when today is off-screen. */
export const nowFractionInWindow = (nowIso: string, window: TimelineWindow): number | null => {
  const f = windowFraction(parseInstant(nowIso).toMillis(), window)
  return f < 0 || f > 1 ? null : f
}

export interface LanePlan {
  /** Lane index (0-based) per milestone id. */
  laneOf: ReadonlyMap<string, number>
  /** Number of lanes needed (at least 1). */
  count: number
}

/**
 * Greedy interval partitioning so overlapping milestones in one category track never draw on top
 * of each other: earliest start first, each bar takes the first lane whose previous bar has ended.
 */
export const packLanes = (milestones: readonly TimeSpan[]): LanePlan => {
  const sorted = [...milestones].sort(
    (a, b) => compareInstants(a.startAt, b.startAt) || a.title.localeCompare(b.title)
  )
  const laneEnds: number[] = []
  const laneOf = new Map<string, number>()
  for (const m of sorted) {
    const start = parseInstant(m.startAt).toMillis()
    const end = parseInstant(m.targetAt).toMillis()
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(end)
    } else {
      laneEnds[lane] = end
    }
    laneOf.set(m.id, lane)
  }
  return { laneOf, count: Math.max(1, laneEnds.length) }
}

export interface AxisTick {
  ms: number
  /** Short label (`Sep 2026`, `2026`) for major ticks; empty for minor gridlines. */
  label: string
  major: boolean
}

/**
 * Axis ticks for a Gantt window, computed in the display zone so month and week boundaries land
 * where the user's calendar puts them. Semester: month majors + weekly minors on the configured
 * week start; year: month majors; multi-year: year majors + quarterly minors. Labels are a short
 * fixed scaffold format; the dates on each bar still follow the user's `dateFormat`.
 */
export const axisTicks = (
  window: TimelineWindow,
  view: TimelineViewKind,
  zone: ZoneInput,
  weekStartsOn: 0 | 1
): AxisTick[] => {
  if (view === 'list') return []
  const luxonZone = resolveZone(zone).luxonZone
  const at = (ms: number): DateTime => DateTime.fromMillis(ms, { zone: luxonZone })
  const ticks: AxisTick[] = []
  const push = (dt: DateTime, label: string, major: boolean): void => {
    const ms = dt.toMillis()
    if (ms >= window.startMs && ms <= window.endMs) ticks.push({ ms, label, major })
  }

  if (view === 'multiYear') {
    for (
      let y = at(window.startMs).startOf('year');
      y.toMillis() <= window.endMs;
      y = y.plus({ years: 1 })
    ) {
      push(y, y.toFormat('yyyy'), true)
      for (const months of [3, 6, 9]) push(y.plus({ months }), '', false)
    }
    return ticks
  }
  for (
    let m = at(window.startMs).startOf('month');
    m.toMillis() <= window.endMs;
    m = m.plus({ months: 1 })
  ) {
    push(m, m.toFormat('LLL yyyy'), true)
  }
  if (view === 'semester') {
    const day = at(window.startMs).startOf('day')
    const offset = weekStartsOn === 1 ? day.weekday - 1 : day.weekday % 7
    for (
      let w = day.minus({ days: offset });
      w.toMillis() <= window.endMs;
      w = w.plus({ weeks: 1 })
    ) {
      push(w, '', false)
    }
  }
  return ticks
}

// ---------------------------------------------------------------------------
// Point markers (followed conference deadlines, spec §12.6 "Timeline markers")

/** Fraction of an instant across the window, or null when it falls outside. */
export const pointInWindow = (instantIso: string, window: TimelineWindow): number | null => {
  const ms = Date.parse(instantIso)
  if (Number.isNaN(ms) || ms < window.startMs || ms > window.endMs) return null
  const span = window.endMs - window.startMs
  return span > 0 ? (ms - window.startMs) / span : 0
}

export interface PointMarkerInput {
  id: string
  fraction: number
}

/**
 * Greedy lane assignment for labelled point markers: markers closer than `minGap` (a fraction of
 * the window width) go to the next free lane so their labels never overlap. Deterministic for the
 * same input; at least one lane is always reported.
 */
export const packPointLanes = (points: readonly PointMarkerInput[], minGap: number): LanePlan => {
  const laneOf = new Map<string, number>()
  const laneLast: number[] = []
  for (const point of [...points].sort(
    (a, b) => a.fraction - b.fraction || a.id.localeCompare(b.id)
  )) {
    let lane = laneLast.findIndex((last) => point.fraction - last >= minGap)
    if (lane === -1) {
      lane = laneLast.length
      laneLast.push(point.fraction)
    } else {
      laneLast[lane] = point.fraction
    }
    laneOf.set(point.id, lane)
  }
  return { laneOf, count: Math.max(1, laneLast.length) }
}
