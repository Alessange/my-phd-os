export interface DeadlineStatusThresholds {
  URGENT_WINDOW_HOURS: number
  URGENT_PROGRESS_CEILING: number
  AT_RISK_GAP: number
  BEHIND_GAP: number
  AHEAD_GAP: number
}

/** Centralised thresholds for the personal deadline status rules (spec §13.2). */
export const DEADLINE_STATUS_THRESHOLDS: Readonly<DeadlineStatusThresholds> = {
  /** `Urgent` when less than this many hours remain … */
  URGENT_WINDOW_HOURS: 24,
  /** … and work progress is below this percentage. */
  URGENT_PROGRESS_CEILING: 90,
  /** `At Risk` when work progress trails time progress by more than this many points. */
  AT_RISK_GAP: 20,
  /** `Behind` when work progress trails time progress by more than this many points. */
  BEHIND_GAP: 8,
  /** `Ahead` when work progress leads time progress by more than this many points. */
  AHEAD_GAP: 10
}
