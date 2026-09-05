import type { ComponentProps } from 'react'
import { cn } from '@renderer/lib/utils'

export function Skeleton({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('animate-pulse-soft rounded-md bg-muted', className)}
      {...props}
    />
  )
}
