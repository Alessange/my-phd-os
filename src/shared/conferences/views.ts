import { CONFERENCE_STATUS_DEFINITIONS } from '../constants/statuses'
import { calculateRemainingTime } from '../dates/countdown'
import type {
  ConferenceDeadlineChangeView,
  ConferenceDeadlineView,
  ConferenceStatus
} from '../types/conference'
import { CONFERENCE_CHANGE_LABELS, type ConferenceChangeField } from './compareSnapshots'

/**
 * Pure view logic for the Conference Deadlines tab (spec §12.4–§12.8): search, facet filters,
 * sort orders, round grouping, the nearest followed deadline, the followed time-elapsed bar and
 * change-notification text. Everything here is derived from canonical records; nothing is stored.
 */

export const CONFERENCE_SORTS = ['nearest', 'farthest', 'name', 'year', 'updated'] as const
export type ConferenceSort = (typeof CONFERENCE_SORTS)[number]

export const CONFERENCE_SORT_LABELS: Readonly<Record<ConferenceSort, string>> = {
  nearest: 'Nearest deadline',
  farthest: 'Farthest deadline',
  name: 'Conference name',
  year: 'Year (newest first)',
  updated: 'Recently updated'
}

export interface ConferenceFilters {
  search: string
  category?: string
  ccfRank?: string
  coreRank?: string
  thcplRank?: string
  year?: number
  status?: ConferenceStatus
  /** Hide passed rounds unless the status filter asks for them explicitly. */
  hidePassed: boolean
  followedOnly: boolean
}

export const DEFAULT_CONFERENCE_FILTERS: ConferenceFilters = {
  search: '',
  hidePassed: true,
  followedOnly: false
}

/** How many controls differ from the defaults (drives the "Clear filters" affordance). */
export const countActiveFilters = (filters: ConferenceFilters): number =>
  [
    filters.search.trim() !== '',
    filters.category !== undefined,
    filters.ccfRank !== undefined,
    filters.coreRank !== undefined,
    filters.thcplRank !== undefined,
    filters.year !== undefined,
    filters.status !== undefined,
    filters.hidePassed !== DEFAULT_CONFERENCE_FILTERS.hidePassed,
    filters.followedOnly !== DEFAULT_CONFERENCE_FILTERS.followedOnly
  ].filter(Boolean).length

const RANK_ORDER = ['A*', 'A', 'B', 'C']
const rankIndex = (rank: string): number => {
  const index = RANK_ORDER.indexOf(rank)
  return index === -1 ? RANK_ORDER.length : index
}
const sortRanks = (ranks: Iterable<string>): string[] =>
  [...new Set(ranks)].sort((a, b) => rankIndex(a) - rankIndex(b) || a.localeCompare(b))

export interface ConferenceFacets {
  categories: string[]
  ccfRanks: string[]
  coreRanks: string[]
  thcplRanks: string[]
  /** Newest first. */
  years: number[]
}

const defined = <T>(values: (T | undefined)[]): T[] =>
  values.filter((value): value is T => value !== undefined)

/** Distinct filter values present in the cached records (never a hard-coded list). */
export const collectFacets = (items: readonly ConferenceDeadlineView[]): ConferenceFacets => ({
  categories: [...new Set(defined(items.map((i) => i.category)))].sort((a, b) =>
    a.localeCompare(b)
  ),
  ccfRanks: sortRanks(defined(items.map((i) => i.ccfRank))),
  coreRanks: sortRanks(defined(items.map((i) => i.coreRank))),
  thcplRanks: sortRanks(defined(items.map((i) => i.thcplRank))),
  years: [...new Set(defined(items.map((i) => i.conferenceYear)))].sort((a, b) => b - a)
})

/** Case-insensitive match on the name-like fields (title, names, location, category, round). */
export const matchesSearch = (item: ConferenceDeadlineView, search: string): boolean => {
  const query = search.trim().toLowerCase()
  if (!query) return true
  return [
    item.title,
    item.conferenceName,
    item.fullName,
    item.location,
    item.category,
    item.comment
  ].some((value) => value?.toLowerCase().includes(query))
}

export const filterConferenceDeadlines = (
  items: readonly ConferenceDeadlineView[],
  filters: ConferenceFilters
): ConferenceDeadlineView[] =>
  items.filter(
    (item) =>
      matchesSearch(item, filters.search) &&
      (filters.category === undefined || item.category === filters.category) &&
      (filters.ccfRank === undefined || item.ccfRank === filters.ccfRank) &&
      (filters.coreRank === undefined || item.coreRank === filters.coreRank) &&
      (filters.thcplRank === undefined || item.thcplRank === filters.thcplRank) &&
      (filters.year === undefined || item.conferenceYear === filters.year) &&
      (filters.status === undefined || item.status === filters.status) &&
      (!filters.hidePassed || filters.status === 'passed' || item.status !== 'passed') &&
      (!filters.followedOnly || item.followed !== undefined)
  )

const STATUS_RANK: Readonly<Record<ConferenceStatus, number>> = { upcoming: 0, tbd: 1, passed: 2 }
const instant = (iso: string | undefined): number => (iso ? Date.parse(iso) : Number.NaN)
const byConferenceName = (a: ConferenceDeadlineView, b: ConferenceDeadlineView): number =>
  (a.conferenceName ?? a.title).localeCompare(b.conferenceName ?? b.title)
const byName = (a: ConferenceDeadlineView, b: ConferenceDeadlineView): number =>
  byConferenceName(a, b) || a.title.localeCompare(b.title)

/**
 * `nearest`: upcoming soonest-first, then TBD (by name), then passed most-recent-first — the order
 * a reader scanning for "what is next" expects. Other orders keep the same status groups.
 */
const compareNearest = (a: ConferenceDeadlineView, b: ConferenceDeadlineView): number => {
  const group = STATUS_RANK[a.status] - STATUS_RANK[b.status]
  if (group !== 0) return group
  if (a.status === 'tbd') return byName(a, b)
  const delta = instant(a.deadlineAt) - instant(b.deadlineAt)
  if (Number.isNaN(delta) || delta === 0) return byName(a, b)
  return a.status === 'passed' ? -delta : delta
}

export const sortConferenceDeadlines = (
  items: readonly ConferenceDeadlineView[],
  sort: ConferenceSort
): ConferenceDeadlineView[] => {
  const copy = [...items]
  switch (sort) {
    case 'nearest':
      return copy.sort(compareNearest)
    case 'farthest':
      return copy.sort((a, b) => {
        const group = STATUS_RANK[a.status] - STATUS_RANK[b.status]
        if (group !== 0) return group
        if (a.status === 'tbd') return byName(a, b)
        const delta = instant(b.deadlineAt) - instant(a.deadlineAt)
        return Number.isNaN(delta) || delta === 0 ? byName(a, b) : delta
      })
    case 'name':
      return copy.sort(
        (a, b) =>
          byConferenceName(a, b) ||
          (b.conferenceYear ?? 0) - (a.conferenceYear ?? 0) ||
          compareNearest(a, b)
      )
    case 'year':
      return copy.sort(
        (a, b) => (b.conferenceYear ?? 0) - (a.conferenceYear ?? 0) || compareNearest(a, b)
      )
    case 'updated':
      return copy.sort(
        (a, b) =>
          instant(b.upstreamUpdatedAt ?? b.updatedAt) -
            instant(a.upstreamUpdatedAt ?? a.updatedAt) || compareNearest(a, b)
      )
  }
}

export interface ConferenceRoundGroup {
  key: string
  name: string
  year?: number
  /** In the order the input was given (already sorted by the caller). */
  items: ConferenceDeadlineView[]
}

/** Rounds of the same conference and year side by side (spec §12.5), preserving the input order. */
export const groupConferenceRounds = (
  items: readonly ConferenceDeadlineView[]
): ConferenceRoundGroup[] => {
  const groups = new Map<string, ConferenceRoundGroup>()
  for (const item of items) {
    const name = item.conferenceName ?? item.title
    const key = `${name.toLowerCase()}|${item.conferenceYear ?? ''}`
    const group = groups.get(key)
    if (group) group.items.push(item)
    else groups.set(key, { key, name, year: item.conferenceYear, items: [item] })
  }
  return [...groups.values()]
}

/** The followed deadline that comes next; passed and TBD rounds never qualify. */
export const nearestFollowedDeadline = (
  items: readonly ConferenceDeadlineView[],
  nowIso: string
): ConferenceDeadlineView | undefined => {
  let nearest: ConferenceDeadlineView | undefined
  for (const item of items) {
    if (!item.followed || item.status !== 'upcoming' || !item.deadlineAt) continue
    if (calculateRemainingTime(item.deadlineAt, nowIso).isPast) continue
    if (!nearest || instant(item.deadlineAt) < instant(nearest.deadlineAt)) nearest = item
  }
  return nearest
}

export interface FollowedTimeProgress {
  /** Elapsed share of `followedAt → deadlineAt`, 0–1. */
  fraction: number
  elapsedMs: number
  totalMs: number
}

/**
 * Time elapsed since the user followed, against the canonical deadline (spec §12.4). This is a
 * time bar, never a work-completion bar; undefined when unfollowed or TBD.
 */
export const followedTimeProgress = (
  item: ConferenceDeadlineView,
  nowIso: string
): FollowedTimeProgress | undefined => {
  if (!item.followed || !item.deadlineAt || item.status === 'tbd') return undefined
  const start = instant(item.followed.followedAt)
  const end = instant(item.deadlineAt)
  const now = instant(nowIso)
  const totalMs = end - start
  if (!(totalMs > 0)) return { fraction: 1, elapsedMs: Math.max(0, now - start), totalMs: 0 }
  const elapsedMs = Math.min(totalMs, Math.max(0, now - start))
  return { fraction: elapsedMs / totalMs, elapsedMs, totalMs }
}

// ---------------------------------------------------------------------------
// Upstream change notifications (spec §12.8)

export const changeHeadline = (change: ConferenceDeadlineChangeView): string =>
  `${change.conferenceTitle} was updated by CCF Deadlines.`

export const changeLabel = (field: string): string =>
  (CONFERENCE_CHANGE_LABELS as Record<string, string>)[field] ?? `${field} changed`

const isStatus = (value: unknown): value is ConferenceStatus =>
  typeof value === 'string' && value in CONFERENCE_STATUS_DEFINITIONS

/** Human text for one side of a change; instants are formatted by the caller. */
export const changeValueText = (
  field: string,
  value: unknown,
  formatInstant: (iso: string) => string
): string => {
  if (value === undefined || value === null || value === '') return '—'
  if ((field as ConferenceChangeField) === 'deadlineAt' && typeof value === 'string') {
    return Number.isNaN(Date.parse(value)) ? value : formatInstant(value)
  }
  if ((field as ConferenceChangeField) === 'status' && isStatus(value)) {
    return CONFERENCE_STATUS_DEFINITIONS[value].label
  }
  return typeof value === 'string' ? value : JSON.stringify(value)
}

/** Followed conferences first (spec: prioritise them), then newest detections. */
export const sortChanges = (
  changes: readonly ConferenceDeadlineChangeView[]
): ConferenceDeadlineChangeView[] =>
  [...changes].sort(
    (a, b) =>
      Number(b.followed) - Number(a.followed) ||
      instant(b.detectedAt) - instant(a.detectedAt) ||
      a.id.localeCompare(b.id)
  )

/** Deadline ids that have at least one unacknowledged change ("Updated from CCF Deadlines"). */
export const updatedDeadlineIds = (changes: readonly ConferenceDeadlineChangeView[]): Set<string> =>
  new Set(changes.filter((c) => !c.acknowledged).map((c) => c.conferenceDeadlineId))

// ---------------------------------------------------------------------------
// Urgency (drives bar colours on the "My conferences" board)

export const URGENCY_LEVELS = ['tbd', 'passed', 'urgent', 'soon', 'near', 'far'] as const
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number]

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/**
 * `urgent` < 24 h · `soon` < 7 days · `near` < 30 days · `far` otherwise; `passed` and `tbd`
 * come straight from the record's status. One glance at the colour says how close it is.
 */
export const urgencyLevel = (
  item: Pick<ConferenceDeadlineView, 'status' | 'deadlineAt'>,
  nowIso: string
): UrgencyLevel => {
  if (item.status === 'tbd' || !item.deadlineAt) return 'tbd'
  const remaining = calculateRemainingTime(item.deadlineAt, nowIso)
  if (item.status === 'passed' || remaining.isPast) return 'passed'
  if (remaining.totalMs < DAY_MS) return 'urgent'
  if (remaining.totalMs < 7 * DAY_MS) return 'soon'
  if (remaining.totalMs < 30 * DAY_MS) return 'near'
  return 'far'
}

/** One short line under a conference title: ranks, abstract flag and round, nothing else. */
export const conferenceSubline = (
  item: Pick<
    ConferenceDeadlineView,
    'ccfRank' | 'coreRank' | 'thcplRank' | 'deadlineKind' | 'deadlineRound' | 'comment'
  >
): string =>
  [
    item.ccfRank ? `CCF ${item.ccfRank}` : undefined,
    item.coreRank ? `CORE ${item.coreRank}` : undefined,
    item.thcplRank ? `TH-CPL ${item.thcplRank}` : undefined,
    item.deadlineKind === 'abstract' ? 'Abstract' : undefined,
    item.deadlineRound ?? item.comment
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ')

// ---------------------------------------------------------------------------
// Row colour and bar length (the board reads as one row per conference)

export const CONFERENCE_COLOR_COUNT = 10

/** Theme colour token for a palette slot: `conference-1` … `conference-10`. */
export const conferenceColorToken = (slot: number): string =>
  `conference-${(((slot % CONFERENCE_COLOR_COUNT) + CONFERENCE_COLOR_COUNT) % CONFERENCE_COLOR_COUNT) + 1}`

/** Small deterministic string hash (FNV-1a), so a conference keeps its colour between runs. */
const hashKey = (key: string): number => {
  let hash = 0x811c9dc5
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * One colour per conference, keyed by `id`. The preferred slot comes from a hash of the stable
 * key, so a conference keeps its colour as deadlines pass and the list reorders; collisions take
 * the next free slot, so up to ten conferences on screen are always distinguishable. Assignment
 * runs in stable-key order, never render order, so the result does not depend on sorting.
 */
export const assignConferenceColors = (
  items: readonly Pick<ConferenceDeadlineView, 'id' | 'stableKey'>[]
): Map<string, string> => {
  const ordered = [...items].sort(
    (a, b) => a.stableKey.localeCompare(b.stableKey) || a.id.localeCompare(b.id)
  )
  const taken = new Set<number>()
  const colors = new Map<string, string>()
  for (const item of ordered) {
    const preferred = hashKey(item.stableKey) % CONFERENCE_COLOR_COUNT
    let slot = preferred
    // Once every slot is in use the palette simply repeats.
    if (taken.size < CONFERENCE_COLOR_COUNT) {
      for (let step = 0; taken.has(slot) && step < CONFERENCE_COLOR_COUNT; step += 1) {
        slot = (preferred + step + 1) % CONFERENCE_COLOR_COUNT
      }
    }
    taken.add(slot)
    colors.set(item.id, conferenceColorToken(slot))
  }
  return colors
}

/** Shortest bar drawn for an upcoming deadline, so a near one is never an invisible sliver. */
export const MIN_BAR_FRACTION = 0.04

/** Longest remaining time among the upcoming items — the shared scale every bar is drawn against. */
export const maxRemainingMs = (
  items: readonly ConferenceDeadlineView[],
  nowIso: string
): number => {
  let max = 0
  for (const item of items) {
    if (item.status !== 'upcoming' || !item.deadlineAt) continue
    const remaining = calculateRemainingTime(item.deadlineAt, nowIso)
    if (!remaining.isPast && remaining.totalMs > max) max = remaining.totalMs
  }
  return max
}

/**
 * How much of the shared scale this conference still has left: a full bar is the furthest
 * deadline, a short bar means time is nearly up. `undefined` for TBD (nothing to measure) and
 * `0` for a deadline that has passed.
 *
 * The scale is the square root of the raw ratio. A single far-off conference otherwise dominates
 * it — against a deadline 200 days away, everything inside a fortnight collapses onto the minimum
 * width and the near ones become indistinguishable, which is exactly when the bar matters most.
 * The root keeps the ordering exact while spreading the near end out; the precise figure is always
 * spelled out in the countdown beside the bar.
 */
export const remainingFraction = (
  item: ConferenceDeadlineView,
  nowIso: string,
  maxMs: number
): number | undefined => {
  if (item.status === 'tbd' || !item.deadlineAt) return undefined
  const remaining = calculateRemainingTime(item.deadlineAt, nowIso)
  if (item.status === 'passed' || remaining.isPast) return 0
  if (maxMs <= 0) return 1
  return Math.min(1, Math.max(MIN_BAR_FRACTION, Math.sqrt(remaining.totalMs / maxMs)))
}
