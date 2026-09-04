import { parseInstant } from './instant'

export interface TimeProgress {
  /** Unclamped ratio; `> 1` once the deadline has passed, `< 0` before tracking starts. */
  raw: number
  /** Ratio clamped to `[0, 1]` for display. */
  clamped: number
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

/**
 * `(now − start) / (deadline − start)`. A tracking start equal to (or after) the deadline yields `1`:
 * there is no window left to elapse.
 */
export const calculateTimeProgress = (
  startIso: string,
  deadlineIso: string,
  nowIso: string
): TimeProgress => {
  const start = parseInstant(startIso).toMillis()
  const deadline = parseInstant(deadlineIso).toMillis()
  const now = parseInstant(nowIso).toMillis()
  const span = deadline - start
  if (span <= 0) return { raw: 1, clamped: 1 }
  const raw = (now - start) / span
  return { raw, clamped: clamp01(raw) }
}

/**
 * Work progress (0–100) minus elapsed time progress in percentage points.
 * Positive means ahead of schedule, negative behind.
 */
export const calculatePaceDifference = (
  workProgressPercent: number,
  timeProgressClamped: number
): number => workProgressPercent - timeProgressClamped * 100
