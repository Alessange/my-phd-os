import * as LabelPrimitive from '@radix-ui/react-label'
import type { ComponentProps } from 'react'
import { cn } from '@renderer/lib/utils'

export interface LabelProps extends ComponentProps<typeof LabelPrimitive.Root> {
  /**
   * `field` (default): the 13 px ink-3 caption above an underline field.
   * `inline`: 15 px ink text beside a checkbox or switch.
   */
  variant?: 'field' | 'inline'
}

export function Label({ className, variant = 'field', ...props }: LabelProps): React.JSX.Element {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        'flex items-center gap-2 select-none',
        variant === 'field' ? 'text-xs text-ink-3' : 'text-sm text-ink',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-[disabled=true]:opacity-50',
        className
      )}
      {...props}
    />
  )
}
