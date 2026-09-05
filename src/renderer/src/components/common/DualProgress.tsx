import { clampPercent } from '@renderer/lib/utils'
import { describePace } from './pace'
import { cn } from '@renderer/lib/utils'
import { ProgressBar } from './ProgressBar'

export interface DualProgressProps {
  /** Elapsed share of the tracking window, 0–100. */
  timePercent: number
  /** Manually entered work completion, 0–100. */
  workPercent: number
  /** `workPercent − timePercent` in percentage points; computed when omitted. */
  paceDifference?: number
  /** Hide the pace sentence (e.g. in compact cards). */
  hidePace?: boolean
  className?: string
}

/** Two clearly separate bars — time elapsed vs. work completed — never merged into one metric (spec §13.2). */
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
    <div className={cn('flex flex-col gap-2', className)}>
      <ProgressBar
        label="Time elapsed"
        value={time}
        indicatorClassName="bg-progress-time"
        size="sm"
      />
      <ProgressBar
        label="Work completed"
        value={work}
        indicatorClassName="bg-progress-work"
        size="sm"
      />
      <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <ul className="flex items-center gap-3" aria-label="Legend">
          <li className="flex items-center gap-1">
            <span aria-hidden="true" className="size-2 rounded-full bg-progress-time" />
            Time
          </li>
          <li className="flex items-center gap-1">
            <span aria-hidden="true" className="size-2 rounded-full bg-progress-work" />
            Work
          </li>
        </ul>
        {!hidePace && (
          <span
            className={cn(
              'tabular font-medium',
              pace > 0 && 'text-status-ahead',
              pace < 0 && 'text-status-behind'
            )}
          >
            {describePace(pace)}
          </span>
        )}
      </div>
    </div>
  )
}
