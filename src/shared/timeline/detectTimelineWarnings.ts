import {
  detectDeadlineAfterMilestoneTarget,
  detectManyHighPrioritySameWeek,
  detectPassedIncomplete,
  detectSignificantOverlap,
  detectStartAfterTarget,
  detectTimeProgressExceedsWork,
  detectTooManyOverlapping,
  UTC_DATE_FORMATTERS,
  type TimelineDateFormatters,
  type TimelineWarning
} from './rules'
import type { Milestone } from '../types/milestone'
import type { PersonalDeadline } from '../types/personalDeadline'

export { RULE_LABELS } from './rules'
export type {
  TimelineDateFormatters,
  TimelineWarning,
  TimelineWarningNavigate,
  TimelineWarningRule
} from './rules'

/**
 * Run all seven timeline checks (spec §15.3). Order is structural issues first, then per-milestone
 * temporal states, then cross-entity (deadline) rules, then overlap. Pure: the caller passes `nowIso`
 * and the week-start setting; the UI filters out dismissed ids. `dates` controls how dates read in
 * the warning text (the renderer passes the user's format and zone; the default is the UTC date).
 */
export const detectTimelineWarnings = (
  milestones: readonly Milestone[],
  deadlines: readonly PersonalDeadline[],
  nowIso: string,
  weekStartsOn: 0 | 1,
  dates: TimelineDateFormatters = UTC_DATE_FORMATTERS
): TimelineWarning[] => [
  ...detectStartAfterTarget(milestones, dates),
  ...detectPassedIncomplete(milestones, nowIso, dates),
  ...detectTimeProgressExceedsWork(milestones, nowIso),
  ...detectDeadlineAfterMilestoneTarget(milestones, deadlines, dates),
  ...detectManyHighPrioritySameWeek(deadlines, weekStartsOn, dates),
  ...detectTooManyOverlapping(milestones),
  ...detectSignificantOverlap(milestones)
]
