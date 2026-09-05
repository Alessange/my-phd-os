import { Progress } from '@renderer/components/ui/progress'
import { clampPercent } from '@renderer/lib/utils'
import { cn } from '@renderer/lib/utils'

export interface ProgressBarProps {
  /** 0–100. */
  value: number
  label: string
  /** Fill colour class (`bg-progress-work`, `bg-status-ahead`, …). */
  indicatorClassName?: string
  /** Replace the percentage text (e.g. `12 of 30 days`). */
  valueText?: string
  size?: 'sm' | 'md'
  className?: string
}

/** Labelled progress bar with its value shown as text. */
export function ProgressBar({
  value,
  label,
  indicatorClassName,
  valueText,
  size = 'md',
  className
}: ProgressBarProps): React.JSX.Element {
  const percent = clampPercent(value)
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-foreground/85">{label}</span>
        <span className="tabular text-muted-foreground">{valueText ?? `${percent}%`}</span>
      </div>
      <Progress
        value={percent}
        aria-label={label}
        indicatorClassName={indicatorClassName}
        size={size}
      />
    </div>
  )
}
