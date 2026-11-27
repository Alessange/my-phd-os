import type { ComponentProps } from 'react'
import { cn } from '@renderer/lib/utils'

/** Multi-line text field: same underline treatment as `Input`. */
export function Textarea({ className, ...props }: ComponentProps<'textarea'>): React.JSX.Element {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'field flex min-h-20 w-full resize-y px-0 py-2 text-sm text-foreground outline-none',
        'placeholder:text-ink-3 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}
