import { Skeleton } from '@renderer/components/ui/skeleton'
import { cn } from '@renderer/lib/utils'

export interface LoadingStateProps {
  label?: string
  /** `skeleton` draws static placeholder rows; `spinner` and `inline` render the plain text label (no spinner). */
  variant?: 'spinner' | 'skeleton' | 'inline'
  rows?: number
  className?: string
}

/** Static loading: the words "Loading..." or quiet placeholder rows in `--track`. Nothing spins or pulses. */
export function LoadingState({
  label = 'Loading…',
  variant = 'spinner',
  rows = 3,
  className
}: LoadingStateProps): React.JSX.Element {
  if (variant === 'skeleton') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={label}
        className={cn('flex flex-col gap-2', className)}
      >
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
        <span className="sr-only">{label}</span>
      </div>
    )
  }
  if (variant === 'inline') {
    return (
      <span role="status" aria-live="polite" className={cn('text-sm text-ink-3', className)}>
        {label}
      </span>
    )
  }
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex items-center justify-center py-12 text-sm text-ink-3', className)}
    >
      {label}
    </div>
  )
}
