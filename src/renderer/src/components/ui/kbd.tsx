import type { ComponentProps } from 'react'
import { cn } from '@renderer/lib/utils'

/** A single key cap. Compose several for chords; see `KeyboardHint`. */
export function Kbd({ className, ...props }: ComponentProps<'kbd'>): React.JSX.Element {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-border bg-muted px-1 font-sans text-[11px] font-medium text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]',
        className
      )}
      {...props}
    />
  )
}
