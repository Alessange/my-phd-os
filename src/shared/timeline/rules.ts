import { compareInstants, dateKeyInZone, parseInstant, startOfWeek } from '../dates'
import { calculatePaceDifference, calculateTimeProgress } from '../dates/progress'
import type { Milestone } from '../types/milestone'
import type { PersonalDeadline } from '../types/personalDeadline'

/**
 * Deterministic timeline checks (spec §15.3). Pure: no clock, no UI, no IPC — the caller passes
 * `nowIso` and `weekStartsOn`. Each warning explains what is wrong, which entities caused it, which
 * rule fired, and where to navigate; the UI owns the Dismiss action, keyed by the stable `id` so a
 * dismissed warning stays dismissed across re-detection. No vague advice is generated: every warning
 * is backed by stored milestone/deadline data.
 */

export type TimelineWarningRule =
  | 'milestone_passed_incomplete'
  | 'deadline_after_milestone_target'
  | 'many_high_priority_deadlines_same_week'
  | 'too_many_overlapping_milestones'
  | 'time_progress_exceeds_work'
  | 'start_after_target'
  | 'significant_overlap'

export interface TimelineWarningNavigate {
  kind: 'timeline' | 'personalDeadlines'
  milestoneId?: string
  deadlineId?: string
  weekStartKey?: string
}

export interface TimelineWarning {
  /** Stable id `<rule>:<joined ids or week key>` so Dismiss persists across re-detections. */
  id: string
  rule: TimelineWarningRule
  /** What the problem is. */
  title: string
  /** Why it fired, naming the entities and dates that caused it. */
  detail: string
  milestoneIds: string[]
  deadlineIds: string[]
  navigateTo: TimelineWarningNavigate
}

// --- thresholds (the spec leaves magnitudes to local judgement; named so they are tunable) ---

/** ≥ this many high/critical deadlines in one local week counts as "multiple". */
const HIGH_PRIORITY_SAME_WEEK_MIN = 2
/** Peak concurrent active milestones at which overlap counts as "too many". */
const TOO_MANY_OVERLAP_THRESHOLD = 4
/** Work-progress lag behind time-progress, in percentage points, that is "substantial". */
const PROGRESS_GAP_PCT = 25
/** Pair overlap counted as "significant" once it spans this many days … */
const SIGNIFICANT_OVERLAP_DAYS = 14
/** … and covers at least this fraction of the shorter milestone's duration. */
const SIGNIFICANT_OVERLAP_FRACTION = 0.5

const DAY_MS = 24 * 60 * 60 * 1000
const msToDays = (ms: number): number => ms / DAY_MS

const isHighPriority = (p: PersonalDeadline['priority']): boolean =>
  p === 'high' || p === 'critical'
/** Whether a milestone still counts toward scheduling-overlap checks (completed ones are done). */
const isActive = (m: Milestone): boolean => m.status !== 'completed'

/** UTC calendar date of an instant as a stable, zone-independent token for detail text. */
const dateOf = (instantIso: string): string => instantIso.slice(0, 10)

const sortIds = (ids: readonly string[]): string[] =>
  [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

const makeId = (rule: TimelineWarningRule, key: string): string => `${rule}:${key}`

const sortByKey = <T>(items: T[], key: (t: T) => string): T[] =>
  [...items].sort((a, b) => {
    const ka = key(a)
    const kb = key(b)
    return ka < kb ? -1 : ka > kb ? 1 : 0
  })

// 6. Start occurs after target — invalid date ordering.
export const detectStartAfterTarget = (milestones: readonly Milestone[]): TimelineWarning[] =>
  milestones
    .filter((m) => compareInstants(m.startAt, m.targetAt) > 0)
    .map((m) => ({
      id: makeId('start_after_target', m.id),
      rule: 'start_after_target',
      title: `"${m.title}" starts after its target date`,
      detail: `Start ${dateOf(m.startAt)} is after target ${dateOf(m.targetAt)}; the dates look reversed.`,
      milestoneIds: [m.id],
      deadlineIds: [],
      navigateTo: { kind: 'timeline', milestoneId: m.id }
    }))

// 1. Target has passed but the milestone isn't complete.
export const detectPassedIncomplete = (
  milestones: readonly Milestone[],
  nowIso: string
): TimelineWarning[] =>
  milestones
    .filter((m) => m.status !== 'completed' && compareInstants(m.targetAt, nowIso) < 0)
    .map((m) => ({
      id: makeId('milestone_passed_incomplete', m.id),
      rule: 'milestone_passed_incomplete',
      title: `Milestone "${m.title}" is past its target but not complete`,
      detail: `"${m.title}" was targeted for ${dateOf(m.targetAt)} and is still ${m.status.replace('_', ' ')}.`,
      milestoneIds: [m.id],
      deadlineIds: [],
      navigateTo: { kind: 'timeline', milestoneId: m.id }
    }))

// 5. Within the window, time progress substantially exceeds work progress.
export const detectTimeProgressExceedsWork = (
  milestones: readonly Milestone[],
  nowIso: string
): TimelineWarning[] => {
  const out: TimelineWarning[] = []
  for (const m of milestones) {
    if (m.status === 'completed') continue
    if (compareInstants(nowIso, m.targetAt) >= 0) continue // passed → rule 1 covers it
    if (compareInstants(nowIso, m.startAt) < 0) continue // not yet started
    const time = calculateTimeProgress(m.startAt, m.targetAt, nowIso)
    const pace = calculatePaceDifference(m.progress, time.clamped) // work% − time%
    if (pace <= -PROGRESS_GAP_PCT) {
      out.push({
        id: makeId('time_progress_exceeds_work', m.id),
        rule: 'time_progress_exceeds_work',
        title: `"${m.title}" is falling behind its schedule`,
        detail: `Time is ${Math.round(time.clamped * 100)}% through but work is only ${m.progress}% done.`,
        milestoneIds: [m.id],
        deadlineIds: [],
        navigateTo: { kind: 'timeline', milestoneId: m.id }
      })
    }
  }
  return out
}

// 2. A deadline linked to a milestone lands after that milestone's target.
export const detectDeadlineAfterMilestoneTarget = (
  milestones: readonly Milestone[],
  deadlines: readonly PersonalDeadline[]
): TimelineWarning[] => {
  const byId = new Map(milestones.map((m) => [m.id, m]))
  const out: TimelineWarning[] = []
  for (const d of deadlines) {
    if (!d.linkedMilestoneId) continue
    const m = byId.get(d.linkedMilestoneId)
    if (!m) continue
    if (compareInstants(d.deadlineAt, m.targetAt) > 0) {
      out.push({
        id: makeId('deadline_after_milestone_target', d.id),
        rule: 'deadline_after_milestone_target',
        title: `Deadline "${d.title}" lands after its linked milestone target`,
        detail: `"${d.title}" is due ${dateOf(d.deadlineAt)}, after milestone "${m.title}" targets ${dateOf(m.targetAt)}.`,
        milestoneIds: [m.id],
        deadlineIds: [d.id],
        navigateTo: { kind: 'personalDeadlines', deadlineId: d.id }
      })
    }
  }
  return out
}

// 3. Several high-priority deadlines fall in the same local week (per-deadline timezone, user's
//    week-start). Completed deadlines don't count.
export const detectManyHighPrioritySameWeek = (
  deadlines: readonly PersonalDeadline[],
  weekStartsOn: 0 | 1
): TimelineWarning[] => {
  const byWeek = new Map<string, PersonalDeadline[]>()
  for (const d of deadlines) {
    if (!isHighPriority(d.priority) || d.status === 'completed') continue
    const weekKey = startOfWeek(dateKeyInZone(d.deadlineAt, d.timezone), weekStartsOn)
    const list = byWeek.get(weekKey) ?? []
    list.push(d)
    byWeek.set(weekKey, list)
  }
  const out: TimelineWarning[] = []
  for (const [weekKey, list] of byWeek) {
    if (list.length >= HIGH_PRIORITY_SAME_WEEK_MIN) {
      out.push({
        id: makeId('many_high_priority_deadlines_same_week', weekKey),
        rule: 'many_high_priority_deadlines_same_week',
        title: `${list.length} high-priority deadlines in the week of ${weekKey}`,
        detail: `${list.map((d) => `"${d.title}"`).join(', ')} all fall in the week starting ${weekKey}.`,
        milestoneIds: [],
        deadlineIds: sortIds(list.map((d) => d.id)),
        navigateTo: { kind: 'personalDeadlines', weekStartKey: weekKey }
      })
    }
  }
  return sortByKey(out, (w) => w.id)
}

// 4. Too many milestones overlap at once (peak concurrent active milestones). Half-open intervals
//    [start, target): a milestone ending exactly when another starts does not count as concurrent.
export const detectTooManyOverlapping = (milestones: readonly Milestone[]): TimelineWarning[] => {
  const active = milestones.filter(isActive)
  type Evt = { t: number; delta: 1 | -1; id: string }
  const events: Evt[] = []
  for (const m of active) {
    events.push({ t: parseInstant(m.startAt).toMillis(), delta: 1, id: m.id })
    events.push({ t: parseInstant(m.targetAt).toMillis(), delta: -1, id: m.id })
  }
  events.sort((a, b) => a.t - b.t || a.delta - b.delta) // ends (-1) before starts (+1) at same instant
  let peak = 0
  let peakGroup: string[] = []
  const current = new Set<string>()
  for (const e of events) {
    if (e.delta === 1) {
      current.add(e.id)
      if (current.size > peak) {
        peak = current.size
        peakGroup = [...current]
      }
    } else {
      current.delete(e.id)
    }
  }
  if (peak < TOO_MANY_OVERLAP_THRESHOLD) return []
  const ids = sortIds(peakGroup)
  return [
    {
      id: makeId('too_many_overlapping_milestones', ids.join('+')),
      rule: 'too_many_overlapping_milestones',
      title: `${peak} milestones overlap at once`,
      detail: `${peak} milestones are active during the same period, which is a lot to juggle at once.`,
      milestoneIds: ids,
      deadlineIds: [],
      navigateTo: { kind: 'timeline', milestoneId: ids[0] }
    }
  ]
}

// 7. A pair of milestones overlaps significantly (long enough and most of the shorter one).
export const detectSignificantOverlap = (milestones: readonly Milestone[]): TimelineWarning[] => {
  const active = milestones.filter(isActive)
  const out: TimelineWarning[] = []
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]
      const b = active[j]
      const aStart = parseInstant(a.startAt).toMillis()
      const aEnd = parseInstant(a.targetAt).toMillis()
      const bStart = parseInstant(b.startAt).toMillis()
      const bEnd = parseInstant(b.targetAt).toMillis()
      const overlapMs = Math.min(aEnd, bEnd) - Math.max(aStart, bStart)
      if (overlapMs <= 0) continue
      const shorter = Math.min(aEnd - aStart, bEnd - bStart)
      const ratio = shorter > 0 ? overlapMs / shorter : 0
      if (
        msToDays(overlapMs) >= SIGNIFICANT_OVERLAP_DAYS &&
        ratio >= SIGNIFICANT_OVERLAP_FRACTION
      ) {
        const ids = sortIds([a.id, b.id])
        out.push({
          id: makeId('significant_overlap', ids.join('+')),
          rule: 'significant_overlap',
          title: `"${a.title}" and "${b.title}" overlap significantly`,
          detail: `"${a.title}" and "${b.title}" run concurrently for ${Math.round(msToDays(overlapMs))} days.`,
          milestoneIds: ids,
          deadlineIds: [],
          navigateTo: { kind: 'timeline', milestoneId: ids[0] }
        })
      }
    }
  }
  return sortByKey(out, (w) => w.id)
}

/** Spec §15.3 wording for each rule, for the warnings panel ("Which rule was triggered"). */
export const RULE_LABELS: Readonly<Record<TimelineWarningRule, string>> = {
  milestone_passed_incomplete: 'Milestone passed but incomplete',
  deadline_after_milestone_target: 'Linked deadline occurs after the milestone target date',
  many_high_priority_deadlines_same_week: 'Multiple high-priority deadlines in the same week',
  too_many_overlapping_milestones: 'Too many overlapping milestones',
  time_progress_exceeds_work: 'Time progress substantially exceeds milestone work progress',
  start_after_target: 'Milestone start occurs after its target',
  significant_overlap: 'Significant milestone overlap'
}
