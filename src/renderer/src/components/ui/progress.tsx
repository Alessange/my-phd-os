import type { ComponentProps } from 'react'
import { clampPercent, cn } from '@renderer/lib/utils'

export interface ProgressProps extends ComponentProps<'div'> {
  /** 0–100; values outside the range are clamped for display. */
  value: number
  /** Accessible name; required because the bar itself has no visible text. */
  'aria-label'?: string
  /** Fill colour class, e.g. `bg-progress-work` (ink) or `bg-progress-time` (ink at 3:1). Default: ink. */
  indicatorClassName?: string
  size?: 'sm' | 'md'
}

/** A 2 px line on a track (DESIGN.md section 9). Print the value beside it; `ProgressBar` does. */
export function Progress({
  className,
  value,
  indicatorClassName,
  size = 'md',
  ...props
}: ProgressProps): React.JSX.Element {
  const percent = clampPercent(value)
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${percent}%`}
      data-slot="progress"
      className={cn(
        'relative h-0.5 w-full overflow-hidden bg-bar-track',
        size === 'sm' && 'h-0.5',
        className
      )}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className={cn('h-full bg-primary transition-[width] duration-150', indicatorClassName)}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
