import { LoaderCircle } from 'lucide-react'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { cn } from '@renderer/lib/utils'

export interface LoadingStateProps {
  label?: string
  /** `skeleton` draws placeholder rows instead of a spinner. */
  variant?: 'spinner' | 'skeleton' | 'inline'
  rows?: number
  className?: string
}

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
      <span
        role="status"
        aria-live="polite"
        className={cn('inline-flex items-center gap-1.5 text-xs text-muted-foreground', className)}
      >
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
        {label}
      </span>
    )
  }
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center gap-2 py-12 text-[13px] text-muted-foreground',
        className
      )}
    >
      <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
      {label}
    </div>
  )
}
