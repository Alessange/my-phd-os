import {
  detectDeadlineAfterMilestoneTarget,
  detectManyHighPrioritySameWeek,
  detectPassedIncomplete,
  detectSignificantOverlap,
  detectStartAfterTarget,
  detectTimeProgressExceedsWork,
  detectTooManyOverlapping,
  type TimelineWarning
} from './rules'
import type { Milestone } from '../types/milestone'
import type { PersonalDeadline } from '../types/personalDeadline'

export { RULE_LABELS } from './rules'
export type { TimelineWarning, TimelineWarningNavigate, TimelineWarningRule } from './rules'

/**
 * Run all seven timeline checks (spec §15.3). Order is structural issues first, then per-milestone
 * temporal states, then cross-entity (deadline) rules, then overlap. Pure: the caller passes `nowIso`
 * and the week-start setting; the UI filters out dismissed ids.
 */
export const detectTimelineWarnings = (
  milestones: readonly Milestone[],
  deadlines: readonly PersonalDeadline[],
  nowIso: string,
  weekStartsOn: 0 | 1
): TimelineWarning[] => [
  ...detectStartAfterTarget(milestones),
  ...detectPassedIncomplete(milestones, nowIso),
  ...detectTimeProgressExceedsWork(milestones, nowIso),
  ...detectDeadlineAfterMilestoneTarget(milestones, deadlines),
  ...detectManyHighPrioritySameWeek(deadlines, weekStartsOn),
  ...detectTooManyOverlapping(milestones),
  ...detectSignificantOverlap(milestones)
]
