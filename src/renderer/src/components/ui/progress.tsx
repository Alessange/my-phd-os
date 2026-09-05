import type { ComponentProps } from 'react'
import { clampPercent, cn } from '@renderer/lib/utils'

export interface ProgressProps extends ComponentProps<'div'> {
  /** 0–100; values outside the range are clamped for display. */
  value: number
  /** Accessible name; required because the bar itself has no visible text. */
  'aria-label'?: string
  /** Fill colour class, e.g. `bg-progress-work` or `bg-status-ahead`. */
  indicatorClassName?: string
  size?: 'sm' | 'md'
}

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
        'relative w-full overflow-hidden rounded-full bg-muted',
        size === 'sm' ? 'h-1.5' : 'h-2',
        className
      )}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className={cn(
          'h-full rounded-full bg-primary transition-[width] duration-300',
          indicatorClassName
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
