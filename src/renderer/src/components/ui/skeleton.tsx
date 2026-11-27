import type { ComponentProps } from 'react'
import { cn } from '@renderer/lib/utils'

/** Static placeholder in `--track` (no pulse: nothing ambient). Reserve the final height to avoid layout shift. */
export function Skeleton({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('rounded-sm bg-track', className)}
      {...props}
    />
  )
}
