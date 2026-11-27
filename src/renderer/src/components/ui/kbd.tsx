import type { ComponentProps } from 'react'
import { cn } from '@renderer/lib/utils'

/** One key of a shortcut: plain 13 px ink-3 text, no key-cap box (DESIGN.md section 6). See `KeyboardHint`. */
export function Kbd({ className, ...props }: ComponentProps<'kbd'>): React.JSX.Element {
  return (
    <kbd data-slot="kbd" className={cn('font-sans text-xs text-ink-3', className)} {...props} />
  )
}
