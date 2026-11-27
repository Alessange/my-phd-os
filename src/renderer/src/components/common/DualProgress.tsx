import { clampPercent, cn } from '@renderer/lib/utils'
import { describePace } from './pace'
import { ProgressBar } from './ProgressBar'

export interface DualProgressProps {
  /** Elapsed share of the tracking window, 0-100. */
  timePercent: number
  /** Manually entered work completion, 0-100. */
  workPercent: number
  /** `workPercent - timePercent` in percentage points; computed when omitted. */
  paceDifference?: number
  /** Hide the pace sentence (e.g. in compact rows). */
  hidePace?: boolean
  className?: string
}

/**
 * Two 2 px lines, time elapsed (lighter) and work completed (ink), each with its value printed
 * (`Time 96%`, `Work 70%`; the accessible names stay `Time elapsed` and `Work completed`). Never merged into one metric (spec section 13.2).
 * No legend: the labels are the legend. The pace sentence is a quiet 13 px ink-2 line.
 */
export function DualProgress({
  timePercent,
  workPercent,
  paceDifference,
  hidePace = false,
  className
}: DualProgressProps): React.JSX.Element {
  const time = clampPercent(timePercent)
  const work = clampPercent(workPercent)
  const pace = paceDifference ?? work - time
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <ProgressBar
        label="Time"
        name="Time elapsed"
        value={time}
        indicatorClassName="bg-progress-time"
        size="sm"
      />
      <ProgressBar
        label="Work"
        name="Work completed"
        value={work}
        indicatorClassName="bg-progress-work"
        size="sm"
      />
      {!hidePace && <span className="tabular text-xs text-ink-2">{describePace(pace)}</span>}
    </div>
  )
}
