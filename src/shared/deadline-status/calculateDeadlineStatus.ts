import { calculateRemainingTime, MS_PER_HOUR, type RemainingTime } from '../dates/countdown'
import {
  calculatePaceDifference,
  calculateTimeProgress,
  type TimeProgress
} from '../dates/progress'
import type { DeadlineStatus, PersonalDeadline } from '../types/personalDeadline'
import { DEADLINE_STATUS_THRESHOLDS, type DeadlineStatusThresholds } from './config'

export type DeadlineStatusInput = Pick<
  PersonalDeadline,
  'trackingStartAt' | 'deadlineAt' | 'progress' | 'status'
>

export interface DeadlineStatusResult {
  status: DeadlineStatus
  timeProgress: TimeProgress
  /** Work progress minus time progress, in percentage points. */
  paceDifference: number
  remaining: RemainingTime
}

/**
 * Deterministic status rules, evaluated in exactly this order (spec §13.2):
 * Completed → Overdue → Urgent → At Risk → Behind → Ahead → On Track.
 */
export const calculateDeadlineStatus = (
  deadline: DeadlineStatusInput,
  nowIso: string,
  thresholds: DeadlineStatusThresholds = DEADLINE_STATUS_THRESHOLDS
): DeadlineStatusResult => {
  const remaining = calculateRemainingTime(deadline.deadlineAt, nowIso)
  const timeProgress = calculateTimeProgress(deadline.trackingStartAt, deadline.deadlineAt, nowIso)
  const timePercent = timeProgress.clamped * 100
  const paceDifference = calculatePaceDifference(deadline.progress, timeProgress.clamped)
  const { progress } = deadline

  const status: DeadlineStatus =
    deadline.status === 'completed'
      ? 'completed'
      : remaining.isPast
        ? 'overdue'
        : remaining.totalMs < thresholds.URGENT_WINDOW_HOURS * MS_PER_HOUR &&
            progress < thresholds.URGENT_PROGRESS_CEILING
          ? 'urgent'
          : progress < timePercent - thresholds.AT_RISK_GAP
            ? 'at_risk'
            : progress < timePercent - thresholds.BEHIND_GAP
              ? 'behind'
              : progress > timePercent + thresholds.AHEAD_GAP
                ? 'ahead'
                : 'on_track'

  return { status, timeProgress, paceDifference, remaining }
}
