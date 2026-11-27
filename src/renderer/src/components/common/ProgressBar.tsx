import { Progress } from '@renderer/components/ui/progress'
import { clampPercent, cn } from '@renderer/lib/utils'

export interface ProgressBarProps {
  /** 0-100. */
  value: number
  label: string
  /** Accessible name when the printed label is short (`Time` -> `Time elapsed`). Default: the label. */
  name?: string
  /** Fill colour class (`bg-progress-work`, `bg-progress-time`). Default ink. */
  indicatorClassName?: string
  /** Replace the percentage text (e.g. `12 of 30 days`). */
  valueText?: string
  size?: 'sm' | 'md'
  className?: string
}

/** Labelled 2 px line with its value printed beside the label in 13 px (`Time 96%`). */
export function ProgressBar({
  value,
  label,
  name,
  indicatorClassName,
  valueText,
  size = 'md',
  className
}: ProgressBarProps): React.JSX.Element {
  const percent = clampPercent(value)
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-ink-2">{label}</span>
        <span className="tabular text-ink-3">{valueText ?? `${percent}%`}</span>
      </div>
      <Progress
        value={percent}
        aria-label={name ?? label}
        indicatorClassName={indicatorClassName}
        size={size}
      />
    </div>
  )
}
