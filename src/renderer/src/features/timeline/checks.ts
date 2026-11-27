import type { TimelineWarning, TimelineWarningRule } from '@shared/timeline/detectTimelineWarnings'
import type { Milestone } from '@shared/types/milestone'

/**
 * Presentation helpers for the Timeline checks (spec §15.3). The rules and thresholds live in
 * `src/shared/timeline`; nothing here decides whether a check fires.
 */

interface RulePresentation {
  /** The small-caps tag at the start of a check row. */
  tag: string
  /** Noun used in the collapsed summary line: [singular, plural]. */
  noun: readonly [string, string]
}

/** Rules in presentation order: things to fix first, then heads-ups. */
const RULE_ORDER: readonly TimelineWarningRule[] = [
  'start_after_target',
  'milestone_passed_incomplete',
  'deadline_after_milestone_target',
  'time_progress_exceeds_work',
  'too_many_overlapping_milestones',
  'significant_overlap',
  'many_high_priority_deadlines_same_week'
]

export const RULE_PRESENTATION: Readonly<Record<TimelineWarningRule, RulePresentation>> = {
  start_after_target: { tag: 'Dates', noun: ['reversed date range', 'reversed date ranges'] },
  milestone_passed_incomplete: { tag: 'Past target', noun: ['past target', 'past target'] },
  deadline_after_milestone_target: {
    tag: 'Late deadline',
    noun: ['late deadline', 'late deadlines']
  },
  time_progress_exceeds_work: { tag: 'Behind', noun: ['behind schedule', 'behind schedule'] },
  too_many_overlapping_milestones: { tag: 'Crowded', noun: ['crowded period', 'crowded periods'] },
  significant_overlap: { tag: 'Overlap', noun: ['overlap', 'overlaps'] },
  many_high_priority_deadlines_same_week: { tag: 'Busy week', noun: ['busy week', 'busy weeks'] }
}

/** Deterministic order: by rule tier, then by title (the detector's own order is by random id). */
export const sortWarnings = (warnings: readonly TimelineWarning[]): TimelineWarning[] =>
  [...warnings].sort(
    (a, b) =>
      RULE_ORDER.indexOf(a.rule) - RULE_ORDER.indexOf(b.rule) || a.title.localeCompare(b.title)
  )

/** `4 open · 1 past target · 3 overlaps`: the line that stands in for the list while it is collapsed. */
export const summarizeWarnings = (warnings: readonly TimelineWarning[]): string => {
  const parts = [`${warnings.length} open`]
  for (const rule of RULE_ORDER) {
    const count = warnings.filter((w) => w.rule === rule).length
    if (count === 0) continue
    const [one, many] = RULE_PRESENTATION[rule].noun
    parts.push(`${count} ${count === 1 ? one : many}`)
  }
  return parts.join(' · ')
}

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * The cause line without the names the title already carries (`"A" and "B" run concurrently for
 * 80 days.` becomes `Run concurrently for 80 days.`). Anything that does not match is left alone.
 */
export const conciseDetail = (detail: string): string => {
  const pair = /^"[^"]+" and "[^"]+" (run concurrently .*)$/.exec(detail)
  if (pair?.[1]) return capitalise(pair[1])
  const passed = /^"[^"]+" was (targeted for .*)$/.exec(detail)
  if (passed?.[1]) return capitalise(passed[1])
  return detail
}

export interface TitleSegment {
  text: string
  /** Set when the segment is a milestone name that should link to its editor. */
  milestoneId?: string
}

/**
 * Split a check title around the quoted names of the milestones it mentions, so each name can be
 * its own link. Only pair checks (two or more milestones) are split; a single-milestone title stays
 * one text node and is opened by the row's Open action.
 */
export const titleSegments = (
  title: string,
  warning: TimelineWarning,
  milestones: readonly Milestone[]
): TitleSegment[] => {
  if (warning.milestoneIds.length < 2) return [{ text: title }]
  const named = warning.milestoneIds
    .flatMap((id) => {
      const m = milestones.find((candidate) => candidate.id === id)
      if (!m) return []
      const needle = `"${m.title}"`
      const at = title.indexOf(needle)
      return at === -1 ? [] : [{ id, needle, at }]
    })
    .sort((a, b) => a.at - b.at)
  if (named.length === 0) return [{ text: title }]
  const segments: TitleSegment[] = []
  let cursor = 0
  for (const { id, needle, at } of named) {
    if (at < cursor) continue
    if (at > cursor) segments.push({ text: title.slice(cursor, at) })
    segments.push({ text: needle, milestoneId: id })
    cursor = at + needle.length
  }
  if (cursor < title.length) segments.push({ text: title.slice(cursor) })
  return segments
}
